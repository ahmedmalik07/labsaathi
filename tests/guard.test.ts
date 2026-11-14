import { describe, expect, it } from "vitest";
import { analyzeDeterministic } from "@/lib/analyze";
import { makeReport } from "@/lib/evals";
import { verifyExtraction } from "@/lib/extract";
import { allowedNumbers, buildFacts } from "@/lib/facts";
import { checkText, withDisclaimer } from "@/lib/guard";
import { samples } from "@/lib/kb";
import { backoffMs, parseRetryAfter } from "@/lib/llm/groq";
import { createSession, readSession } from "@/lib/session";
import { templateExplanation } from "@/lib/template";

const factsFor = (id: string) => buildFacts(analyzeDeterministic({ reportText: samples.find((s) => s.id === id)!.raw }));

describe("engine facts (what the LLM sees)", () => {
  it("carry no name, no MRN and no other patient", () => {
    for (const s of samples) {
      const json = JSON.stringify(factsFor(s.id));
      expect(json).not.toContain(s.label);
      expect(json).not.toMatch(/CLD-P\d+/);
      for (const other of samples) if (other.id !== s.id) expect(json).not.toContain(other.label);
    }
  });
});

describe("guard", () => {
  const facts = factsFor("P004");
  const allowed = allowedNumbers(facts);

  it("accepts text that only uses engine numbers", () => {
    expect(checkText("Your hemoglobin is 6.5 g/dL. The normal range is 12.1 to 15.1 g/dL. Please see a doctor today.", allowed).ok).toBe(true);
    expect(checkText("Your platelet count is 120000 cells/mcL, below 150000.", allowed).ok).toBe(true);
    expect(checkText("Vitamin B12 and T3 are other tests.\n1. Ask your doctor.\n2. Rest.", allowed).ok).toBe(true);
  });

  it("rejects numbers that are not in the engine output", () => {
    const v = checkText("Normal hemoglobin is 13.0 to 17.5 g/dL and you should rest for 3 days.", allowed);
    expect(v.ok).toBe(false);
    expect(v.violations.join(" ")).toMatch(/13/);
    expect(v.violations.join(" ")).toMatch(/17\.5/);
    expect(v.violations.join(" ")).toMatch(/number 3 /);
  });

  const diagnoses = [
    "You have anemia.",
    "This means you have diabetes.",
    "You may have a liver problem.",
    "You are suffering from an infection.",
    "The patient has hepatitis.",
    "This confirms a thyroid problem.",
    "You were diagnosed with anemia.",
    "It indicates diabetes.",
    "Aap ko diabetes hai.",
    "Aap ko khoon ki kami ho gayi hai.",
    "You've got low blood.",
  ];
  for (const text of diagnoses) {
    it(`rejects diagnosis phrasing: ${text}`, () => expect(checkText(text, allowed).ok).toBe(false));
  }

  const fine = [
    "Low hemoglobin can sometimes be linked with a lack of iron. Only a doctor can tell what it means for you.",
    "Your level is lower than the normal range.",
    "Do I need more tests?",
    "If you have any questions, ask your doctor.",
    "Aap ka hemoglobin normal range se kam hai. Apne doctor se poochein.",
  ];
  for (const text of fine) {
    it(`accepts: ${text}`, () => expect(checkText(text, allowed).ok).toBe(true));
  }

  it("always attaches the doctor line", () => {
    expect(withDisclaimer("Your value is normal.", "en")).toMatch(/Only a licensed medical doctor can diagnose/);
    expect(withDisclaimer("Aap ka result normal hai.", "roman-urdu")).toMatch(/licensed doctor hi/);
    const once = withDisclaimer(withDisclaimer("x", "en"), "en");
    expect(once.match(/Only a licensed/g)).toHaveLength(1);
  });
});

describe("template explanation (LLM fully down)", () => {
  for (const lang of ["en", "roman-urdu"] as const) {
    it(`passes its own guard for every sample report (${lang})`, () => {
      for (const s of samples) {
        const facts = factsFor(s.id);
        const e = templateExplanation(facts, lang);
        const texts = [e.overview, ...e.tests.flatMap((t) => [t.measures, t.meaning]), ...e.doctorQuestions];
        for (const text of texts) expect(checkText(text, allowedNumbers(facts)), `${s.id}: ${text}`).toMatchObject({ ok: true });
        expect(e.doctorQuestions.length).toBeGreaterThanOrEqual(3);
        expect(e.doctorQuestions.length).toBeLessThanOrEqual(5);
        expect(e.tests).toHaveLength(facts.tests.length);
        expect(e.disclaimer).toMatch(/doctor/i);
        expect(e.source).toBe("template");
      }
    });
  }

  it("tells an urgent patient to see a doctor today", () => {
    const e = templateExplanation(factsFor("P013"), "en");
    expect(e.overview + e.tests[0].meaning).toMatch(/See a doctor today/);
  });
});

describe("LLM extraction fallback is verified against the text", () => {
  const text = "Haemoglobin level came back as 13.5 g/dL today.\nSugar was 110 mg/dL.";
  it("keeps values that literally appear", () => {
    const out = verifyExtraction([{ name: "Haemoglobin", value: "13.5", unit: "g/dL" }], text);
    expect(out.tests).toHaveLength(1);
    expect(out.tests[0]).toMatchObject({ name: "Haemoglobin", value: "13.5", unit: "g/dL" });
  });
  it("rejects invented or altered values and names", () => {
    const out = verifyExtraction(
      [
        { name: "Haemoglobin", value: "13.6", unit: "g/dL" },
        { name: "Sugar", value: "11", unit: "mg/dL" },
        { name: "Cholesterol", value: "110", unit: "mg/dL" },
      ],
      text,
    );
    expect(out.tests).toHaveLength(0);
    expect(out.rejected).toHaveLength(3);
  });
});

describe("sessions are bound to one report", () => {
  const facts = factsFor("P001");
  it("round-trips a signed token", () => {
    const token = createSession({ name: "Alice Smith", mrn: "CLD-P001-9942", facts });
    expect(readSession(token)).toMatchObject({ name: "Alice Smith", mrn: "CLD-P001-9942", facts });
  });
  it("rejects a tampered or foreign token", () => {
    const a = createSession({ name: "Alice Smith", mrn: "CLD-P001-9942", facts });
    const b = createSession({ name: "Diana Prince", mrn: "CLD-P004-9942", facts: factsFor("P004") });
    const spliced = `${b.split(".")[0]}.${a.split(".")[1]}`;
    expect(readSession(spliced)).toBeNull();
    expect(readSession(a.slice(0, -2) + "xx")).toBeNull();
    expect(readSession("garbage")).toBeNull();
  });
});

describe("rate-limit helpers", () => {
  it("parses Retry-After in the shapes Groq uses", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter("1.5s")).toBe(1500);
    expect(parseRetryAfter("1m26.4s")).toBe(86400);
    expect(parseRetryAfter("750ms")).toBe(750);
    expect(parseRetryAfter(null)).toBeNull();
  });
  it("backs off exponentially and stays under the cap", () => {
    for (let i = 0; i < 20; i++) {
      expect(backoffMs(0)).toBeLessThanOrEqual(400);
      expect(backoffMs(1)).toBeGreaterThanOrEqual(400);
      expect(backoffMs(1)).toBeLessThanOrEqual(800);
      expect(backoffMs(10)).toBeLessThanOrEqual(4000);
    }
  });
});

describe("report in an unseen layout, end to end", () => {
  it("classifies and keeps the trace", () => {
    const out = analyzeDeterministic({ reportText: makeReport({ sex: "Male", age: "60", body: "Hb ........ 13.8 g/dL\nSGPT = 56 U/L" }) });
    expect(out.results.map((r) => [r.canonicalName, r.status])).toEqual([
      ["Hemoglobin", "normal"],
      ["ALT", "high"],
    ]);
  });
});
