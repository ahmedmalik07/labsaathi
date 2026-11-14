import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanText, cleaningStats } from "@/lib/cleaner";
import { buildReferenceTables, parseRangeSpec } from "@/lib/reference";
import { reference } from "@/lib/kb";

const dir = join(process.cwd(), "lab_reports");
const files = readdirSync(dir).map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
const line = (file: string, n: number) => files.find((f) => f.name === file)!.text.split(/\r?\n/)[n - 1];

describe("cleaner", () => {
  it("removes every appendix and keeps the sections", () => {
    for (const f of files) {
      const cleaned = cleanText(f.text);
      expect(cleaned).not.toMatch(/APPENDIX/);
      expect(cleaned.length).toBeGreaterThan(50);
      expect(cleaningStats(f.text).removedPct).toBeGreaterThan(80);
    }
  });

  it("stops stripping at the next ## heading", () => {
    const text = "## A\nkeep 1\n### APPENDIX 1: X\ndrop\n\ndrop too\n## B\nkeep 2\n### APPENDIX 2\ndrop";
    expect(cleanText(text)).toBe("## A\nkeep 1\n## B\nkeep 2");
  });
});

describe("reference loader", () => {
  it("parses straight from the files and matches the generated knowledge base", () => {
    expect(buildReferenceTables(files)).toEqual(reference);
  });

  it("loads the glossary aliases", () => {
    const map = Object.fromEntries(reference.aliases.map((a) => [a.alias, a.canonical]));
    expect(map).toMatchObject({
      SGPT: "ALT",
      SGOT: "AST",
      FBS: "Fasting Blood Sugar",
      Hb: "Hemoglobin",
      PLT: "Platelet Count",
      RBC: "Red Blood Cell Count",
      WBC: "White Blood Cell Count",
    });
  });

  it("every range row cites a line that really contains its numbers", () => {
    expect(reference.ranges.length).toBeGreaterThanOrEqual(13);
    for (const r of reference.ranges) {
      const src = line(r.source.file, r.source.line);
      expect(src, `${r.test} -> ${r.source.file}:${r.source.line}`).toBeTruthy();
      const numbers = (src.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
      if (r.low !== null) expect(numbers).toContain(r.low);
      if (r.high !== null) expect(numbers).toContain(r.high);
      if (r.qualitative) expect(src).toContain(r.qualitative);
      if (r.unit) expect(src).toContain(r.unit);
    }
  });

  it("every urgent row cites a line that contains its threshold", () => {
    expect(reference.urgent).toHaveLength(4);
    for (const u of reference.urgent) {
      const src = line(u.source.file, u.source.line);
      expect(src).toContain(u.test);
      expect((src.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)).toContain(u.threshold);
      expect(u.direction).toBe(/less/i.test(src) ? "low" : "high");
    }
  });

  it("finds the six rules it cites", () => {
    expect(reference.rules.map((r) => r.id).sort()).toEqual([
      "boundary",
      "missing_demographics",
      "no_diagnosis",
      "privacy",
      "unknown_tests",
      "urgent_wording",
    ]);
  });

  it("parses range fragments in several shapes", () => {
    expect(parseRangeSpec("Male Demographic (18-100 yrs): 13.8 - 17.2 g/dL")).toMatchObject({ sex: "male", ageMin: 18, ageMax: 100, low: 13.8, high: 17.2, unit: "g/dL" });
    expect(parseRangeSpec(": 4.5 - 8.0 (Applicable to All sexes, 18-100 yrs).")).toMatchObject({ sex: "all", low: 4.5, high: 8, unit: null });
    expect(parseRangeSpec(": Negative (Applicable to All sexes, 18-100 yrs).")).toMatchObject({ qualitative: "Negative", low: null, high: null });
    expect(parseRangeSpec("Female (20 to 60 years): up to 200 mg/dL")).toMatchObject({ sex: "female", ageMin: 20, ageMax: 60, low: null, high: 200, unit: "mg/dL" });
  });
});
