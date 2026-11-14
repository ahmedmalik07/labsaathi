/**
 * Engine facts: the ONLY thing the LLM ever sees.
 * It is built from the rules-engine output for the current patient. It holds no
 * name and no MRN (those never leave our server), no other patient's data, and
 * no raw report text.
 */
import type { EngineOutput, Sex, Status } from "./types";

export interface FactTest {
  test: string;
  reportedAs: string;
  value: string;
  unit: string | null;
  converted: string | null;
  status: Status;
  direction: "low" | "high" | null;
  normalRange: string | null;
  rangeFor: string | null;
  sourceFile: string | null;
  note: string | null;
}

export interface EngineFacts {
  age: number | null;
  sex: Sex | null;
  urgent: boolean;
  tests: FactTest[];
  missing: Array<"age" | "sex">;
}

export function buildFacts(out: EngineOutput): EngineFacts {
  return {
    age: out.patient.age,
    sex: out.patient.sex,
    urgent: out.urgent,
    missing: out.patient.missing,
    tests: out.results.map((r) => {
      const range = r.rangeUsed;
      let normalRange: string | null = null;
      if (range) {
        if (range.qualitative) normalRange = range.qualitative;
        else if (range.low !== null && range.high !== null) normalRange = `${range.low} to ${range.high}${range.unit ? " " + range.unit : ""}`;
        else if (range.high !== null) normalRange = `up to ${range.high}${range.unit ? " " + range.unit : ""}`;
        else if (range.low !== null) normalRange = `${range.low}${range.unit ? " " + range.unit : ""} or more`;
      }
      let note: string | null = null;
      if (r.status === "unclassified") note = "The lab's reference files do not cover this result, so it cannot be classified from the files.";
      if (r.status === "needs_info") note = `Not classified yet: the ${r.missingFields.join(" and ")} of the patient is missing from the report.`;
      if (r.status === "urgent") note = "This value reached the lab's urgent limit. The patient should see a doctor today.";
      return {
        test: r.canonicalName,
        reportedAs: r.originalName,
        value: r.rawValue,
        unit: r.unit,
        converted: r.conversion ? `${r.conversion.toValue} ${r.conversion.toUnit}` : null,
        status: r.status,
        direction: r.direction,
        normalRange,
        rangeFor: range ? `${range.sex === "all" ? "all sexes" : range.sex}, age ${range.ageMin} to ${range.ageMax}` : null,
        sourceFile: range?.source.file ?? null,
        note,
      };
    }),
  };
}

/** Every number the guard allows in LLM text: the ones in the facts, nothing else. */
export function allowedNumbers(facts: EngineFacts): number[] {
  const text = JSON.stringify(facts);
  const found = new Set<number>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) found.add(n);
  }
  // Counting the tests on the report ("2 of your 3 results") is not inventing a value.
  for (let i = 0; i <= facts.tests.length; i++) found.add(i);
  return [...found];
}
