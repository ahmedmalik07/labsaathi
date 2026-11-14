import { describe, expect, it } from "vitest";
import { knownNames, samples } from "@/lib/kb";
import { isPlaceholder, parseAge, parseReport, parseSex, parseValueUnit } from "@/lib/parser";

const parse = (text: string) => parseReport(text, { knownNames });

describe("demographics", () => {
  it("treats bracketed placeholders, blanks and words as missing", () => {
    for (const v of ["[NOT PROVIDED]", "[DATA CORRUPTED]", "[anything at all]", "", "  ", "N/A", "unknown", "--"]) {
      expect(isPlaceholder(v), v).toBe(true);
      expect(parseAge(v), v).toBeNull();
      expect(parseSex(v), v).toBeNull();
    }
    expect(parseAge("forty")).toBeNull();
    expect(parseAge("28")).toBe(28);
    expect(parseAge("28 years")).toBe(28);
    expect(parseAge("101")).toBe(101);
    expect(parseSex("F")).toBe("female");
    expect(parseSex("Male")).toBe("male");
    expect(parseSex("other")).toBeNull();
  });

  it("reads all 14 sample reports: name, MRN and at least one test each", () => {
    expect(samples).toHaveLength(14);
    for (const s of samples) {
      const r = parse(s.raw);
      expect(r.patient.name, s.file).toBeTruthy();
      expect(r.patient.mrn, s.file).toMatch(/^CLD-P\d+-\d+$/);
      expect(r.tests.length, s.file).toBeGreaterThan(0);
      expect(r.cleanedText).not.toMatch(/APPENDIX/);
    }
  });

  it("does not infer sex from the name", () => {
    const bob = parse(samples.find((s) => s.id === "P002")!.raw);
    expect(bob.patient).toMatchObject({ name: "Bob Jones", sex: "female", age: 35 });
    const laura = parse(samples.find((s) => s.id === "P012")!.raw);
    expect(laura.patient).toMatchObject({ name: "Laura Croft", sex: null, age: 32, missing: ["sex"] });
  });
});

describe("layouts", () => {
  const body = (b: string) => `## PATIENT DETAILS\nName: A B\nAge: 30\nSex: F\n## RESULTS\n${b}`;
  const cases: Array<[string, string, Array<[string, string, string | null]>]> = [
    ["plain list", "- Hemoglobin: 13.5 g/dL\n- WBC: 6000 cells/mcL", [["Hemoglobin", "13.5", "g/dL"], ["WBC", "6000", "cells/mcL"]]],
    ["bold bullets", "* **Hemoglobin**: 6.5 g/dL\n- **FBS**: 6.0 mmol/L", [["Hemoglobin", "6.5", "g/dL"], ["FBS", "6.0", "mmol/L"]]],
    ["table: Test Name / Result / Unit", "| Test Name | Result | Unit |\n| :--- | :--- | :--- |\n| SGPT | 45 | U/L |", [["SGPT", "45", "U/L"]]],
    ["table: Test / Value / Unit", "| Test | Value | Unit |\n| :--- | :--- | :--- |\n| ALT | 85 | U/L |\n| AST | 60 | U/L |", [["ALT", "85", "U/L"], ["AST", "60", "U/L"]]],
    ["table without a unit column", "| Parameter | Observed |\n|---|---|\n| TSH | 2.5 mIU/L |", [["TSH", "2.5", "mIU/L"]]],
    ["table with unknown headers", "| Foo | Bar | Baz |\n|---|---|---|\n| Cholesterol | 200 | mg/dL |", [["Cholesterol", "200", "mg/dL"]]],
    ["Test / Result pairs", "Test: AST\nResult: 44 U/L", [["AST", "44", "U/L"]]],
    ["Test Conducted / Value Recorded pairs", "Test Conducted: Fasting Blood Sugar\nValue Recorded: 110 mg/dL", [["Fasting Blood Sugar", "110", "mg/dL"]]],
    ["pair with separate unit line", "Test: TSH\nResult: 2.5\nUnit: mIU/L", [["TSH", "2.5", "mIU/L"]]],
    ["arrow", "* pH Level -> 5.5\n* Protein -> Negative", [["pH Level", "5.5", null], ["Protein", "Negative", null]]],
    ["bare line", "TSH: 2.5 mIU/L", [["TSH", "2.5", "mIU/L"]]],
    ["equals and dot leaders", "Hb = 13.5 g/dL\nCholesterol ...... 180 mg/dL", [["Hb", "13.5", "g/dL"], ["Cholesterol", "180", "mg/dL"]]],
    ["known name without separator", "Hemoglobin 13.5 g/dL", [["Hemoglobin", "13.5", "g/dL"]]],
  ];
  for (const [name, text, want] of cases) {
    it(name, () => {
      const got = parse(body(text)).tests.map((t) => [t.name, t.value, t.unit]);
      expect(got).toEqual(want);
    });
  }

  it("ignores dates, ids and prose", () => {
    const r = parse(body("Date of Issuance: 2026-11-13\nSample ID: 12345\nPage: 2\nThe data is presented below:\nNote: repeat in 3 months\n- Hemoglobin: 13.5 g/dL"));
    expect(r.tests.map((t) => t.name)).toEqual(["Hemoglobin"]);
  });

  it("parses value strings", () => {
    expect(parseValueUnit("13.5 g/dL (H)")).toEqual({ value: "13.5", unit: "g/dL" });
    expect(parseValueUnit("120,000 cells/mcL")).toEqual({ value: "120,000", unit: "cells/mcL" });
    expect(parseValueUnit("Negative")).toEqual({ value: "Negative", unit: null });
    expect(parseValueUnit("2026-11-13")).toBeNull();
    expect(parseValueUnit("see below")).toBeNull();
    expect(parseValueUnit("44 U/L")).toEqual({ value: "44", unit: "U/L" });
  });

  it("returns no tests for text that has none", () => {
    expect(parse("Hello, this is not a lab report.").extraction).toBe("none");
  });
});
