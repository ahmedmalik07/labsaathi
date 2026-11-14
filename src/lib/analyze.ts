/**
 * Deterministic analysis pipeline: clean -> parse -> rules engine.
 * No LLM is involved here, so this is what the tests and the /evals page run.
 */
import { cleaningStats } from "./cleaner";
import { runEngine, type EngineOptions } from "./engine";
import { knownNames, reference } from "./kb";
import { parseAge, parseReport, parseSex } from "./parser";
import type { EngineOutput, ParsedReport, ParsedTest, Patient, ReferenceTables, TraceStep } from "./types";

export interface AnalyzeInput {
  reportText: string;
  age?: number | string | null;
  sex?: string | null;
  /** Optional file name or title. Only used as context ("...Urine.md"). */
  fileName?: string | null;
}

export interface DeterministicAnalysis extends EngineOutput {
  parsed: ParsedReport;
  cleaning: { rawChars: number; cleanChars: number; removedPct: number };
}

/** Fills missing demographics from user input. A value printed in the report always wins. */
export function mergeDemographics(patient: Patient, input: Pick<AnalyzeInput, "age" | "sex">, trace: TraceStep[]): Patient {
  const merged: Patient = { ...patient, missing: [...patient.missing] };
  const suppliedAge = parseAge(input.age ?? null);
  const suppliedSex = parseSex(input.sex ?? null);

  if (suppliedAge !== null) {
    if (merged.age === null) {
      merged.age = suppliedAge;
      merged.missing = merged.missing.filter((m) => m !== "age");
      trace.push({ step: "demographics", detail: `Age ${suppliedAge} was supplied by the user because the report did not give it.` });
    } else if (merged.age !== suppliedAge) {
      trace.push({ step: "note", detail: `The user supplied age ${suppliedAge}, but the report says ${merged.age}. The report value is used.` });
    }
  }
  if (suppliedSex !== null) {
    if (merged.sex === null) {
      merged.sex = suppliedSex;
      merged.missing = merged.missing.filter((m) => m !== "sex");
      trace.push({ step: "demographics", detail: `Sex "${suppliedSex}" was supplied by the user because the report did not give it.` });
    } else if (merged.sex !== suppliedSex) {
      trace.push({ step: "note", detail: `The user supplied sex "${suppliedSex}", but the report says "${merged.sex}". The report value is used.` });
    }
  }
  return merged;
}

export function analyzeParsed(
  parsed: ParsedReport,
  input: AnalyzeInput,
  tables: ReferenceTables = reference,
  options: EngineOptions = {},
  tests: ParsedTest[] = parsed.tests,
): DeterministicAnalysis {
  const extra: TraceStep[] = [];
  const patient = mergeDemographics(parsed.patient, input, extra);
  const cleaning = cleaningStats(input.reportText);
  const out = runEngine(tests, patient, tables, {
    ...options,
    contextText: options.contextText ?? `${parsed.cleanedText}\n${input.fileName ?? ""}`,
  });
  const head: TraceStep = {
    step: "parse",
    detail: `Cleaner removed ${cleaning.removedPct}% of the text (appendix boilerplate): ${cleaning.rawChars} -> ${cleaning.cleanChars} characters.`,
  };
  const notes: TraceStep[] = parsed.notes.map((n) => ({ step: "note", detail: n }));
  return { ...out, trace: [head, ...out.trace, ...extra, ...notes], parsed, cleaning };
}

export function analyzeDeterministic(input: AnalyzeInput, tables: ReferenceTables = reference, options: EngineOptions = {}): DeterministicAnalysis {
  const parsed = parseReport(input.reportText, { knownNames });
  return analyzeParsed(parsed, input, tables, options);
}
