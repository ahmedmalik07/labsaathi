/**
 * Shared types for the Samjho pipeline.
 * cleaner -> reference loader -> report parser -> rules engine -> explainer -> guard
 */

export type Sex = "male" | "female";
export type RangeSex = Sex | "all";

/** Where a fact came from inside lab_reports/. Every engine decision carries one. */
export interface SourceRef {
  file: string;
  line: number;
}

export interface AliasRow {
  alias: string;
  canonical: string;
  source: SourceRef;
}

export interface UrgentRow {
  test: string;
  /** "low" means the file says "Less than", "high" means "Greater than". */
  direction: "low" | "high";
  comparatorText: string;
  threshold: number;
  unit: string | null;
  source: SourceRef;
}

export interface RangeRow {
  test: string;
  sex: RangeSex;
  ageMin: number;
  ageMax: number;
  low: number | null;
  high: number | null;
  /** For qualitative tests (for example "Negative"). */
  qualitative: string | null;
  unit: string | null;
  source: SourceRef;
}

export interface RuleRef {
  id: "privacy" | "no_diagnosis" | "missing_demographics" | "unknown_tests" | "boundary" | "urgent_wording";
  text: string;
  source: SourceRef;
}

export interface ReferenceTables {
  aliases: AliasRow[];
  urgent: UrgentRow[];
  ranges: RangeRow[];
  rules: RuleRef[];
}

export interface ParsedTest {
  name: string;
  /** Raw value exactly as written in the report, for example "13.5" or "Negative". */
  value: string;
  unit: string | null;
  /** Which parser layout produced this row. */
  layout: string;
  line: number;
}

export interface Patient {
  name: string | null;
  age: number | null;
  sex: Sex | null;
  mrn: string | null;
  /** Demographic fields that were missing, bracketed or unreadable. */
  missing: Array<"age" | "sex">;
}

export interface ParsedReport {
  patient: Patient;
  tests: ParsedTest[];
  cleanedText: string;
  /** "deterministic" | "llm" | "none" */
  extraction: "deterministic" | "llm" | "none";
  notes: string[];
}

export type Status =
  | "normal"
  | "low"
  | "high"
  | "abnormal"
  | "urgent"
  | "needs_info"
  | "unclassified";

export interface TraceStep {
  step:
    | "parse"
    | "alias"
    | "context"
    | "unit"
    | "conversion"
    | "urgent"
    | "range"
    | "demographics"
    | "classify"
    | "note";
  detail: string;
  source?: SourceRef;
}

export interface RangeUsed {
  low: number | null;
  high: number | null;
  qualitative: string | null;
  unit: string | null;
  sex: RangeSex;
  ageMin: number;
  ageMax: number;
  source: SourceRef;
}

export interface Conversion {
  fromValue: number;
  fromUnit: string;
  toValue: number;
  toUnit: string;
  factor: number;
  formula: string;
  basis: string;
}

export interface TestResult {
  canonicalName: string;
  originalName: string;
  value: number | string;
  rawValue: string;
  unit: string | null;
  convertedValue: number | null;
  convertedUnit: string | null;
  conversion: Conversion | null;
  rangeUsed: RangeUsed | null;
  status: Status;
  /** low / high direction for urgent and out-of-range results. */
  direction: "low" | "high" | null;
  urgent: boolean;
  warning: string | null;
  /** Exact question to ask when status is needs_info. */
  question: string | null;
  missingFields: Array<"age" | "sex">;
  /** One line a human can read without the trace. */
  summary: string;
  /** 0..1 position of the value on a scale where the normal range spans 0.25..0.75. */
  position: number | null;
  matchedBy: "exact" | "alias" | "normalized" | "context" | "none";
  trace: TraceStep[];
}

export interface NeedsInfo {
  field: "age" | "sex";
  question: string;
  /** Tests that cannot be classified until this field is supplied. */
  blocking: string[];
  source: SourceRef | null;
}

export interface EngineOutput {
  patient: Patient;
  results: TestResult[];
  urgent: boolean;
  urgentMessage: string | null;
  needsInfo: NeedsInfo[];
  trace: TraceStep[];
}

export interface TestExplanation {
  test: string;
  measures: string;
  meaning: string;
}

export interface Explanation {
  lang: "en" | "roman-urdu";
  overview: string;
  tests: TestExplanation[];
  doctorQuestions: string[];
  disclaimer: string;
  /** "llm" when Groq wrote it and it passed the guard, "template" otherwise. */
  source: "llm" | "template";
  model: string | null;
  guard: { passed: boolean; attempts: number; violations: string[] };
}
