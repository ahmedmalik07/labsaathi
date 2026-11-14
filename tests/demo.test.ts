import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeDeterministic } from "@/lib/analyze";

/** The three downloadable demo reports in public/demo must behave exactly as the demo script says. */
const run = (file: string, extra: { age?: number; sex?: string } = {}) =>
  analyzeDeterministic({ reportText: readFileSync(join(process.cwd(), "public", "demo", file), "utf8"), ...extra }, undefined, { strictNames: false });
const table = (out: ReturnType<typeof run>) => Object.fromEntries(out.results.map((r) => [r.canonicalName, r.status]));

describe("demo reports", () => {
  it("demo 1: every reference test at once, one urgent result, aliases, a conversion and two on-the-limit values", () => {
    const out = run("demo_1_ayesha_full_checkup.md");
    expect(out.patient).toMatchObject({ name: "Ayesha Khan", age: 34, sex: "female" });
    expect(table(out)).toEqual({
      Hemoglobin: "urgent",
      "White Blood Cell Count": "normal",
      "Platelet Count": "low",
      ALT: "normal",
      "Fasting Blood Sugar": "normal",
      Cholesterol: "normal",
      TSH: "high",
    });
    expect(out.urgent).toBe(true);
    expect(out.results.find((r) => r.canonicalName === "Fasting Blood Sugar")?.convertedValue).toBe(93.6);
  });

  it("demo 2: asks for age and sex, then classifies once they are given", () => {
    const before = run("demo_2_bilal_missing_details.md");
    expect(before.needsInfo.map((n) => n.field).sort()).toEqual(["age", "sex"]);
    expect(before.results.every((r) => r.status === "needs_info")).toBe(true);
    const after = run("demo_2_bilal_missing_details.md", { age: 40, sex: "male" });
    expect(table(after)).toEqual({ AST: "normal", Hemoglobin: "low", "Fasting Blood Sugar": "high" });
    expect(table(run("demo_2_bilal_missing_details.md", { age: 40, sex: "female" })).AST).toBe("high");
  });

  it("demo 3: messy layout, urgent after conversion, and honest 'cannot classify' answers", () => {
    const out = run("demo_3_sana_messy_layout.md");
    expect(out.patient).toMatchObject({ name: "Sana Malik", age: 52, sex: "female" });
    expect(table(out)).toEqual({
      "Fasting Blood Sugar": "urgent",
      "Platelet Count": "high",
      "Serum Ferritin": "unclassified",
      "Red Blood Cell Count": "unclassified",
      Cholesterol: "unclassified",
      "Urine Protein": "abnormal",
      "Urine pH": "normal",
    });
    expect(out.results.find((r) => r.canonicalName === "Fasting Blood Sugar")?.convertedValue).toBe(306);
  });
});
