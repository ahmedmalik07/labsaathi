import { describe, expect, it } from "vitest";
import { classifyAgainstRange, isUrgent, normUnit, resolveName, runEngine, toReferenceUnit } from "@/lib/engine";
import { reference } from "@/lib/kb";
import type { ParsedTest, Patient } from "@/lib/types";

const patient = (age: number | null, sex: Patient["sex"]): Patient => ({
  name: "T",
  age,
  sex,
  mrn: null,
  missing: [...(age === null ? (["age"] as const) : []), ...(sex === null ? (["sex"] as const) : [])],
});
const test = (name: string, value: string, unit: string | null): ParsedTest => ({ name, value, unit, layout: "list", line: 1 });
const run = (t: ParsedTest, p: Patient) => runEngine([t], p, reference, { strictNames: false }).results[0];

describe("every boundary value in every range row (generated from the files)", () => {
  const numeric = reference.ranges.filter((r) => r.low !== null && r.high !== null);
  it("has rows to test", () => expect(numeric.length).toBeGreaterThanOrEqual(12));

  for (const r of numeric) {
    const sex = r.sex === "all" ? "female" : r.sex;
    const step = Math.max((r.high! - r.low!) / 1000, 0.001);
    const label = `${r.test} / ${r.sex} (${r.low}-${r.high})`;
    const urgent = reference.urgent.filter((u) => u.test === r.test);
    const wouldBeUrgent = (v: number) => urgent.some((u) => isUrgent(v, u));

    for (const age of [r.ageMin, r.ageMax]) {
      it(`${label}, age ${age}: exactly on the low limit is normal`, () => {
        expect(run(test(r.test, String(r.low), r.unit), patient(age, sex)).status).toBe("normal");
      });
      it(`${label}, age ${age}: exactly on the high limit is normal`, () => {
        expect(run(test(r.test, String(r.high), r.unit), patient(age, sex)).status).toBe("normal");
      });
    }
    it(`${label}: just below the low limit is low`, () => {
      const v = r.low! - step;
      const out = run(test(r.test, String(v), r.unit), patient(r.ageMin, sex));
      expect(out.status).toBe(wouldBeUrgent(v) ? "urgent" : "low");
    });
    it(`${label}: just above the high limit is high`, () => {
      const v = r.high! + step;
      const out = run(test(r.test, String(v), r.unit), patient(r.ageMax, sex));
      expect(out.status).toBe(wouldBeUrgent(v) ? "urgent" : "high");
    });
    it(`${label}: age ${r.ageMin - 1} and ${r.ageMax + 1} are outside the sheet`, () => {
      const mid = String((r.low! + r.high!) / 2);
      expect(run(test(r.test, mid, r.unit), patient(r.ageMin - 1, sex)).status).toBe("unclassified");
      expect(run(test(r.test, mid, r.unit), patient(r.ageMax + 1, sex)).status).toBe("unclassified");
    });
    it(`${label}: the result cites ${r.source.file}`, () => {
      const out = run(test(r.test, String(r.low), r.unit), patient(r.ageMin, sex));
      expect(out.rangeUsed?.source).toEqual(r.source);
      expect(out.trace.some((s) => s.source?.file === r.source.file)).toBe(true);
    });
    if (r.sex !== "all") {
      it(`${label}: missing sex -> needs_info with a question`, () => {
        const out = run(test(r.test, String(r.low), r.unit), patient(30, null));
        expect(out.status).toBe("needs_info");
        expect(out.missingFields).toEqual(["sex"]);
        expect(out.question).toMatch(/biological sex/);
        expect(out.rangeUsed).toBeNull();
      });
    }
  }
});

describe("urgent thresholds (generated from file 3)", () => {
  for (const u of reference.urgent) {
    const p = patient(40, "female");
    it(`${u.test}: a value equal to ${u.threshold} is urgent ("hit or pass")`, () => {
      const out = run(test(u.test, String(u.threshold), u.unit), p);
      expect(out.status).toBe("urgent");
      expect(out.urgent).toBe(true);
      expect(out.direction).toBe(u.direction);
      expect(out.warning).toMatch(/see a doctor today/i);
      expect(out.trace.some((s) => s.step === "urgent" && s.source?.file === u.source.file)).toBe(true);
    });
    it(`${u.test}: one step on the safe side of ${u.threshold} is not urgent`, () => {
      const safe = u.direction === "low" ? u.threshold + 0.1 : u.threshold - 0.1;
      expect(run(test(u.test, String(safe), u.unit), p).urgent).toBe(false);
    });
    it(`${u.test}: far past ${u.threshold} is urgent`, () => {
      const far = u.direction === "low" ? u.threshold / 2 : u.threshold * 2;
      expect(run(test(u.test, String(far), u.unit), p).status).toBe("urgent");
    });
  }
});

describe("pure helpers", () => {
  it("classifyAgainstRange treats limits as normal", () => {
    expect(classifyAgainstRange(45, 7, 45)).toBe("normal");
    expect(classifyAgainstRange(7, 7, 45)).toBe("normal");
    expect(classifyAgainstRange(45.01, 7, 45)).toBe("high");
    expect(classifyAgainstRange(6.99, 7, 45)).toBe("low");
  });

  it("converts glucose mmol/L to mg/dL and shows the formula", () => {
    const out = toReferenceUnit(6.0, "mmol/L", "mg/dL", "Fasting Blood Sugar");
    expect(out).toMatchObject({ ok: true, value: 108 });
    if (out.ok) expect(out.conversion?.formula).toBe("6 mmol/L x 18 = 108 mg/dL");
  });

  it("does not apply the glucose factor to other tests", () => {
    expect(toReferenceUnit(5.2, "mmol/L", "mg/dL", "Cholesterol").ok).toBe(false);
  });

  it("treats unit spelling variants as the same unit", () => {
    expect(normUnit("cells/µL")).toBe(normUnit("cells/mcL"));
    expect(normUnit("MG/DL")).toBe(normUnit("mg/dL"));
    expect(toReferenceUnit(5, "u/l", "U/L", "ALT")).toMatchObject({ ok: true, value: 5, conversion: null });
  });

  it("resolves aliases without regard to case, and refuses unknown names", () => {
    expect(resolveName("sgpt", reference, true)).toMatchObject({ canonical: "ALT", matchedBy: "alias" });
    expect(resolveName("Sgot", reference, true)).toMatchObject({ canonical: "AST", matchedBy: "alias" });
    expect(resolveName("HEMOGLOBIN", reference, true)).toMatchObject({ canonical: "Hemoglobin", matchedBy: "exact" });
    expect(resolveName("Serum Ferritin", reference, false).matchedBy).toBe("none");
    expect(resolveName("Platelets", reference, false)).toMatchObject({ canonical: "Platelet Count", matchedBy: "normalized" });
    expect(resolveName("Platelets", reference, true).matchedBy).toBe("none");
    expect(resolveName("HDL Cholesterol", reference, false).matchedBy).toBe("none");
  });

  it("reports urgent at report level with the doctor warning", () => {
    const out = runEngine([test("Hb", "6.5", "g/dL"), test("WBC", "6000", "cells/mcL")], patient(42, "female"), reference);
    expect(out.urgent).toBe(true);
    expect(out.urgentMessage).toMatch(/See a doctor today/);
    expect(out.results.map((r) => r.status)).toEqual(["urgent", "normal"]);
  });

  it("a single stray 'Protein' is not read as urine protein", () => {
    const out = runEngine([test("Protein", "Negative", null)], patient(30, "female"), reference, { contextText: "liver panel" });
    expect(out.results[0].status).toBe("unclassified");
  });
});
