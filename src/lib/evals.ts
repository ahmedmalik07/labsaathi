/**
 * Acceptance cases as data. The same list is run by Vitest (tests/acceptance.test.ts)
 * and by the live /evals page, so the page can never drift from the test suite.
 *
 * The expectations are test expectations, not engine inputs: the engine never reads this file.
 */
import { analyzeDeterministic, type AnalyzeInput } from "./analyze";
import { reference, samples } from "./kb";
import { checkPrivacy } from "./privacy";
import type { Status } from "./types";

export interface ExpectedTest {
  /** Canonical name after alias resolution. */
  name: string;
  status: Status;
  direction?: "low" | "high";
  convertedValue?: number;
  originalName?: string;
  matchedBy?: "exact" | "alias" | "normalized" | "context" | "none";
}

export interface EvalCase {
  id: string;
  title: string;
  group: "sample reports" | "boundaries" | "urgent thresholds" | "age limits" | "units and names" | "layouts" | "privacy";
  /** Either a sample id (text is read from the corpus) or inline report text. */
  sampleId?: string;
  reportText?: string;
  input?: Omit<AnalyzeInput, "reportText">;
  strictNames?: boolean;
  expect: {
    tests?: ExpectedTest[];
    testCount?: number;
    urgent?: boolean;
    needsInfo?: Array<"age" | "sex">;
    patient?: { name?: string | null; age?: number | null; sex?: "male" | "female" | null };
  };
  /** Privacy cases: the chat message and whether it must be refused. */
  chat?: { message: string; refused: boolean };
}

export interface EvalCheck {
  label: string;
  pass: boolean;
  want: string;
  got: string;
}

export interface EvalResult {
  id: string;
  title: string;
  group: EvalCase["group"];
  pass: boolean;
  checks: EvalCheck[];
  ms: number;
}

/** Builds a minimal report in the corpus house style. */
export function makeReport(opts: { name?: string; age?: string; sex?: string; mrn?: string; body: string }): string {
  return [
    "# CITYLAB DIAGNOSTICS - COMPREHENSIVE ANALYTICAL REPORT",
    "## SECTION I: PATIENT DEMOGRAPHICS & ENCOUNTER DETAILS",
    `* **Patient Full Name**: ${opts.name ?? "Test Patient"}`,
    `* **Recorded Age**: ${opts.age ?? "30"}`,
    `* **Biological Sex**: ${opts.sex ?? "Female"}`,
    `* **Medical Record Number (MRN)**: ${opts.mrn ?? "CLD-P900-0001"}`,
    "",
    "## SECTION III: ANALYTICAL RESULTS",
    opts.body,
    "",
    "### APPENDIX 1: EXTENDED DOCUMENTATION",
    "Boilerplate that mentions Hemoglobin: 1.0 g/dL and urine and must be ignored.",
  ].join("\n");
}

const SAMPLE_CASES: EvalCase[] = [
  { id: "P001", title: "Alice, F 28: Hemoglobin 13.5 normal, WBC 6000 normal", group: "sample reports", sampleId: "P001", expect: { patient: { name: "Alice Smith", age: 28, sex: "female" }, urgent: false, testCount: 2, tests: [{ name: "Hemoglobin", status: "normal" }, { name: "White Blood Cell Count", status: "normal", originalName: "WBC", matchedBy: "alias" }] } },
  { id: "P002", title: "Bob Jones, F 35: SGPT 45 -> ALT, female max 45, on the limit -> normal", group: "sample reports", sampleId: "P002", expect: { patient: { name: "Bob Jones", age: 35, sex: "female" }, testCount: 1, tests: [{ name: "ALT", status: "normal", originalName: "SGPT", matchedBy: "alias" }] } },
  { id: "P003", title: "Charlie: age and sex missing -> asks, no classification", group: "sample reports", sampleId: "P003", expect: { patient: { age: null, sex: null }, needsInfo: ["age", "sex"], testCount: 1, tests: [{ name: "Fasting Blood Sugar", status: "needs_info" }] } },
  { id: "P004", title: "Diana, F 42: Hemoglobin 6.5 urgent (low), Platelets 120000 low", group: "sample reports", sampleId: "P004", expect: { urgent: true, testCount: 2, tests: [{ name: "Hemoglobin", status: "urgent", direction: "low" }, { name: "Platelet Count", status: "low", direction: "low" }] } },
  { id: "P005", title: "Ethan, M 50: FBS 6.0 mmol/L -> 108 mg/dL -> high, conversion shown", group: "sample reports", sampleId: "P005", expect: { urgent: false, testCount: 1, tests: [{ name: "Fasting Blood Sugar", status: "high", direction: "high", convertedValue: 108 }] } },
  { id: "P006", title: "Fiona: Serum Ferritin -> cannot be classified from the files", group: "sample reports", sampleId: "P006", expect: { testCount: 1, tests: [{ name: "Serum Ferritin", status: "unclassified", matchedBy: "none" }] } },
  { id: "P007", title: "George, M 65: TSH 2.5 normal", group: "sample reports", sampleId: "P007", expect: { testCount: 1, tests: [{ name: "TSH", status: "normal" }] } },
  { id: "P008", title: "Haley, F 19: pH 5.5 normal, Protein Negative normal (matched by context)", group: "sample reports", sampleId: "P008", expect: { testCount: 2, tests: [{ name: "Urine pH", status: "normal", originalName: "pH Level", matchedBy: "context" }, { name: "Urine Protein", status: "normal", originalName: "Protein", matchedBy: "context" }] } },
  { id: "P008-strict", title: "Haley in strict mode: urine names are not guessed", group: "sample reports", sampleId: "P008", strictNames: true, expect: { tests: [{ name: "pH Level", status: "unclassified" }, { name: "Protein", status: "unclassified" }] } },
  { id: "P009", title: "Ian, M 48: ALT 85 high, AST 60 high", group: "sample reports", sampleId: "P009", expect: { testCount: 2, tests: [{ name: "ALT", status: "high" }, { name: "AST", status: "high" }] } },
  { id: "P010", title: "Julia, F 55: Cholesterol 200, on the limit -> normal", group: "sample reports", sampleId: "P010", expect: { testCount: 1, tests: [{ name: "Cholesterol", status: "normal" }] } },
  { id: "P011", title: "Kevin, M 40: WBC 12000 high, PLT 140000 low", group: "sample reports", sampleId: "P011", expect: { urgent: false, testCount: 2, tests: [{ name: "White Blood Cell Count", status: "high" }, { name: "Platelet Count", status: "low", originalName: "PLT" }] } },
  { id: "P012", title: "Laura, 32, sex missing: AST 44 -> asks for sex (normal for male, high for female)", group: "sample reports", sampleId: "P012", expect: { patient: { age: 32, sex: null }, needsInfo: ["sex"], tests: [{ name: "AST", status: "needs_info" }] } },
  { id: "P012-male", title: "Laura after the user answers 'male': AST 44 normal", group: "sample reports", sampleId: "P012", input: { sex: "male" }, expect: { needsInfo: [], tests: [{ name: "AST", status: "normal" }] } },
  { id: "P012-female", title: "Laura after the user answers 'female': AST 44 high", group: "sample reports", sampleId: "P012", input: { sex: "F" }, expect: { needsInfo: [], tests: [{ name: "AST", status: "high" }] } },
  { id: "P013", title: "Michael, M 45: FBS 350 urgent (high)", group: "sample reports", sampleId: "P013", expect: { urgent: true, tests: [{ name: "Fasting Blood Sugar", status: "urgent", direction: "high" }] } },
  { id: "P014", title: "Nancy, F 29: FBS 85 normal, SGOT 22 -> AST normal", group: "sample reports", sampleId: "P014", expect: { testCount: 2, tests: [{ name: "Fasting Blood Sugar", status: "normal", originalName: "FBS" }, { name: "AST", status: "normal", originalName: "SGOT", matchedBy: "alias" }] } },
];

const SYNTHETIC_CASES: EvalCase[] = [
  // urgent thresholds, exactly on the number ("hit or pass")
  { id: "U-hb-7.0", title: "Hemoglobin exactly 7.0 -> urgent (hit or pass)", group: "urgent thresholds", reportText: makeReport({ body: "- Hemoglobin: 7.0 g/dL" }), expect: { urgent: true, tests: [{ name: "Hemoglobin", status: "urgent", direction: "low" }] } },
  { id: "U-hb-7.1", title: "Hemoglobin 7.1 -> low, not urgent", group: "urgent thresholds", reportText: makeReport({ body: "- Hemoglobin: 7.1 g/dL" }), expect: { urgent: false, tests: [{ name: "Hemoglobin", status: "low" }] } },
  { id: "U-fbs-300", title: "Fasting Blood Sugar exactly 300 -> urgent", group: "urgent thresholds", reportText: makeReport({ body: "- FBS: 300 mg/dL" }), expect: { urgent: true, tests: [{ name: "Fasting Blood Sugar", status: "urgent", direction: "high" }] } },
  { id: "U-fbs-299", title: "Fasting Blood Sugar 299 -> high, not urgent", group: "urgent thresholds", reportText: makeReport({ body: "- FBS: 299 mg/dL" }), expect: { urgent: false, tests: [{ name: "Fasting Blood Sugar", status: "high" }] } },
  { id: "U-plt-50000", title: "Platelet Count exactly 50000 -> urgent", group: "urgent thresholds", reportText: makeReport({ body: "- PLT: 50000 cells/mcL" }), expect: { urgent: true, tests: [{ name: "Platelet Count", status: "urgent", direction: "low" }] } },
  { id: "U-alt-1000", title: "ALT exactly 1000 -> urgent", group: "urgent thresholds", reportText: makeReport({ body: "- SGPT: 1000 U/L" }), expect: { urgent: true, tests: [{ name: "ALT", status: "urgent", direction: "high" }] } },
  { id: "U-alt-999", title: "ALT 999 -> high, not urgent", group: "urgent thresholds", reportText: makeReport({ body: "- ALT: 999 U/L" }), expect: { urgent: false, tests: [{ name: "ALT", status: "high" }] } },
  { id: "U-mmol", title: "Urgent check runs after conversion: FBS 17 mmol/L = 306 mg/dL -> urgent", group: "urgent thresholds", reportText: makeReport({ body: "- FBS: 17 mmol/L" }), expect: { urgent: true, tests: [{ name: "Fasting Blood Sugar", status: "urgent", convertedValue: 306 }] } },
  { id: "U-no-demo", title: "Urgent value with missing sex still warns", group: "urgent thresholds", reportText: makeReport({ sex: "[NOT PROVIDED]", body: "- Hb: 6.0 g/dL" }), expect: { urgent: true, needsInfo: ["sex"], tests: [{ name: "Hemoglobin", status: "urgent", direction: "low" }] } },

  // age limits
  { id: "A-17", title: "Age 17 is outside 18-100 -> cannot be classified", group: "age limits", reportText: makeReport({ age: "17", body: "- TSH: 2.5 mIU/L" }), expect: { tests: [{ name: "TSH", status: "unclassified" }] } },
  { id: "A-18", title: "Age 18 is inside (inclusive)", group: "age limits", reportText: makeReport({ age: "18", body: "- TSH: 2.5 mIU/L" }), expect: { tests: [{ name: "TSH", status: "normal" }] } },
  { id: "A-100", title: "Age 100 is inside (inclusive)", group: "age limits", reportText: makeReport({ age: "100", body: "- TSH: 2.5 mIU/L" }), expect: { tests: [{ name: "TSH", status: "normal" }] } },
  { id: "A-101", title: "Age 101 is outside 18-100 -> cannot be classified", group: "age limits", reportText: makeReport({ age: "101", body: "- TSH: 2.5 mIU/L" }), expect: { tests: [{ name: "TSH", status: "unclassified" }] } },
  { id: "A-text", title: "Age 'forty' is not a number -> treated as missing, asks", group: "age limits", reportText: makeReport({ age: "forty", body: "- TSH: 2.5 mIU/L" }), expect: { needsInfo: ["age"], tests: [{ name: "TSH", status: "needs_info" }] } },
  { id: "A-blank", title: "Blank age -> asks", group: "age limits", reportText: makeReport({ age: "", body: "- Cholesterol: 180 mg/dL" }), expect: { needsInfo: ["age"], tests: [{ name: "Cholesterol", status: "needs_info" }] } },
  { id: "A-supplied", title: "Missing age supplied by the user -> classified", group: "age limits", reportText: makeReport({ age: "[DATA CORRUPTED]", body: "- Cholesterol: 180 mg/dL" }), input: { age: 44 }, expect: { needsInfo: [], tests: [{ name: "Cholesterol", status: "normal" }] } },
  { id: "A-name-not-sex", title: "Sex is never inferred from a name ('Mr John King', sex missing)", group: "age limits", reportText: makeReport({ name: "Mr John King", sex: "[NOT PROVIDED]", body: "- Hemoglobin: 13.0 g/dL" }), expect: { patient: { sex: null }, needsInfo: ["sex"], tests: [{ name: "Hemoglobin", status: "needs_info" }] } },

  // units and names
  { id: "N-unit", title: "Unknown unit (Hemoglobin in furlongs) -> cannot be classified", group: "units and names", reportText: makeReport({ body: "- Hemoglobin: 13.5 furlongs" }), expect: { tests: [{ name: "Hemoglobin", status: "unclassified" }] } },
  { id: "N-chol-mmol", title: "Cholesterol in mmol/L: no conversion in the files -> cannot be classified", group: "units and names", reportText: makeReport({ body: "- Cholesterol: 5.2 mmol/L" }), expect: { tests: [{ name: "Cholesterol", status: "unclassified" }] } },
  { id: "N-lower", title: "Lowercase aliases: sgpt, sgot, fbs, hb, plt, wbc", group: "units and names", reportText: makeReport({ body: "- sgpt: 30 U/L\n- sgot: 30 U/L\n- fbs: 90 mg/dL\n- hb: 13.0 g/dL\n- plt: 200000 cells/mcL\n- wbc: 7000 cells/mcL" }), expect: { testCount: 6, tests: [{ name: "ALT", status: "normal" }, { name: "AST", status: "normal" }, { name: "Fasting Blood Sugar", status: "normal" }, { name: "Hemoglobin", status: "normal" }, { name: "Platelet Count", status: "normal" }, { name: "White Blood Cell Count", status: "normal" }] } },
  { id: "N-rbc", title: "RBC has an alias but no range -> cannot be classified", group: "units and names", reportText: makeReport({ body: "- RBC: 4.8 million/mcL" }), expect: { tests: [{ name: "Red Blood Cell Count", status: "unclassified", matchedBy: "alias" }] } },
  { id: "N-fullname", title: "Glossary long form: Alanine Aminotransferase -> ALT", group: "units and names", reportText: makeReport({ body: "- Alanine Aminotransferase: 50 U/L" }), expect: { tests: [{ name: "ALT", status: "high" }] } },
  { id: "N-paren", title: "Name with alias in brackets: Hemoglobin (Hb)", group: "units and names", reportText: makeReport({ body: "- Hemoglobin (Hb): 12.1 g/dL" }), expect: { tests: [{ name: "Hemoglobin", status: "normal" }] } },
  { id: "N-protein-pos", title: "Urine Protein 'Trace' -> abnormal", group: "units and names", reportText: makeReport({ body: "- Urine Protein: Trace\n- Urine pH: 8.0" }), expect: { tests: [{ name: "Urine Protein", status: "abnormal" }, { name: "Urine pH", status: "normal" }] } },
  { id: "N-serum-protein", title: "'Total Protein' in a liver panel is NOT read as Urine Protein", group: "units and names", reportText: makeReport({ body: "- ALT: 30 U/L\n- Total Protein: 7.0 g/dL" }), expect: { tests: [{ name: "ALT", status: "normal" }, { name: "Total Protein", status: "unclassified" }] } },
  { id: "N-urine-explicit", title: "Explicit urine context: 'Urinalysis' heading + pH -> Urine pH", group: "units and names", reportText: makeReport({ body: "Urinalysis panel\n- pH: 9.0" }), expect: { tests: [{ name: "Urine pH", status: "high", matchedBy: "context" }] } },
  { id: "N-comma", title: "Thousands separator: 120,000 cells/mcL", group: "units and names", reportText: makeReport({ body: "- Platelet Count: 120,000 cells/mcL" }), expect: { tests: [{ name: "Platelet Count", status: "low" }] } },
  { id: "N-gL", title: "Metric rescale: Hemoglobin 135 g/L = 13.5 g/dL", group: "units and names", reportText: makeReport({ body: "- Hemoglobin: 135 g/L" }), expect: { tests: [{ name: "Hemoglobin", status: "normal", convertedValue: 13.5 }] } },

  { id: "N-order", title: "Word order: 'Blood Sugar (Fasting)' is Fasting Blood Sugar", group: "units and names", reportText: makeReport({ body: "- Blood Sugar (Fasting): 100 mg/dL" }), expect: { tests: [{ name: "Fasting Blood Sugar", status: "high", matchedBy: "normalized" }] } },
  { id: "N-random", title: "'Random Blood Sugar' is a different test -> cannot be classified", group: "units and names", reportText: makeReport({ body: "- Random Blood Sugar: 150 mg/dL" }), expect: { tests: [{ name: "Random Blood Sugar", status: "unclassified", matchedBy: "none" }] } },
  { id: "N-serum", title: "'Serum ALT' is ALT, 'Serum Ferritin' is still unknown", group: "units and names", reportText: makeReport({ body: "- Serum ALT: 30 U/L\n- Serum Ferritin: 25 ng/mL" }), expect: { tests: [{ name: "ALT", status: "normal", matchedBy: "normalized" }, { name: "Serum Ferritin", status: "unclassified" }] } },
  { id: "N-dipstick", title: "Urine Protein '2+' -> abnormal", group: "units and names", reportText: makeReport({ body: "- Urine Protein: 2+" }), expect: { tests: [{ name: "Urine Protein", status: "abnormal" }] } },
  { id: "N-strict", title: "Strict mode: 'Platelets' is not in the glossary -> cannot be classified", group: "units and names", strictNames: true, reportText: makeReport({ body: "- Platelets: 200000 cells/mcL\n- PLT: 200000 cells/mcL" }), expect: { tests: [{ name: "Platelets", status: "unclassified" }, { name: "Platelet Count", status: "normal", matchedBy: "alias" }] } },

  // layouts
  { id: "L-measure", title: "Pair layout with other key names, marker after the value", group: "layouts", reportText: makeReport({ body: "Parameter: Hb\nMeasurement: 6.9 g/dL *\nUnits: g/dL\n\nName of Test: TSH\nObserved Value: 4.1 mIU/L" }), expect: { testCount: 2, urgent: true, tests: [{ name: "Hemoglobin", status: "urgent" }, { name: "TSH", status: "high" }] } },
  { id: "L-unseen", title: "Layout not in the samples: dot leaders, '=', wide columns", group: "layouts", reportText: makeReport({ body: "Hemoglobin ........ 11.0 g/dL\nWBC = 6000 cells/mcL\nPlatelet Count      451000     cells/mcL\nTSH 4.0 mIU/L" }), expect: { testCount: 4, tests: [{ name: "Hemoglobin", status: "low" }, { name: "White Blood Cell Count", status: "normal" }, { name: "Platelet Count", status: "high" }, { name: "TSH", status: "normal" }] } },
  { id: "L-table-ref", title: "Table with reordered columns, flag and reference columns", group: "layouts", reportText: makeReport({ body: "| Unit | Investigation | Reference Range | Observed Value | Flag |\n| --- | --- | --- | --- | --- |\n| U/L | SGOT | 8 - 43 | 50 | H |\n| mg/dL | Cholesterol | 125 - 200 | 125 | |" }), expect: { testCount: 2, tests: [{ name: "AST", status: "high" }, { name: "Cholesterol", status: "normal" }] } },
  { id: "L-inline-demo", title: "Demographics on one line: 'Age/Sex: 51/M', flag after value", group: "layouts", reportText: "LAB REPORT\nPatient Name: Omar Farooq\nAge/Sex: 51/M\nMRN: CLD-P777-1000\n\nRESULTS\nHb: 17.3 g/dL (H)\nTest: FBS, Result: 99 mg/dL", expect: { patient: { name: "Omar Farooq", age: 51, sex: "male" }, testCount: 2, tests: [{ name: "Hemoglobin", status: "high" }, { name: "Fasting Blood Sugar", status: "normal" }] } },
  { id: "L-appendix", title: "Numbers inside an appendix are ignored", group: "layouts", reportText: makeReport({ body: "- Hemoglobin: 14.0 g/dL" }), expect: { testCount: 1, tests: [{ name: "Hemoglobin", status: "normal" }] } },

  // privacy lock
  { id: "X-other-mrn", title: "Chat asks for another MRN -> refused before any LLM call", group: "privacy", sampleId: "P001", chat: { message: "What was the hemoglobin for MRN CLD-P004-9942?", refused: true }, expect: {} },
  { id: "X-other-name", title: "Chat names another patient -> refused", group: "privacy", sampleId: "P001", chat: { message: "Tell me about Diana Prince's results too", refused: true }, expect: {} },
  { id: "X-other-report", title: "Chat asks about 'other patients' -> refused", group: "privacy", sampleId: "P001", chat: { message: "Do other patients have lower values than me?", refused: true }, expect: {} },
  { id: "X-stranger", title: "Chat names a person we hold no record for -> still refused", group: "privacy", sampleId: "P001", chat: { message: "Can you show me Sara Khan's report?", refused: true }, expect: {} },
  { id: "X-own", title: "Chat about the session's own patient -> allowed", group: "privacy", sampleId: "P001", chat: { message: "Is Alice Smith's hemoglobin okay? What does WBC mean?", refused: false }, expect: {} },
];

export const EVAL_CASES: EvalCase[] = [...SAMPLE_CASES, ...SYNTHETIC_CASES];

export function caseText(c: EvalCase): string {
  if (c.reportText !== undefined) return c.reportText;
  const sample = samples.find((s) => s.id === c.sampleId);
  if (!sample) throw new Error(`Sample ${c.sampleId} not found in the corpus`);
  return sample.raw;
}

export function runEvalCase(c: EvalCase): EvalResult {
  const started = performance.now();
  const checks: EvalCheck[] = [];
  const add = (label: string, want: unknown, got: unknown) => {
    const w = JSON.stringify(want);
    const g = JSON.stringify(got);
    checks.push({ label, pass: w === g, want: w, got: g ?? "undefined" });
  };

  try {
    const out = analyzeDeterministic({ reportText: caseText(c), ...(c.input ?? {}) }, reference, { strictNames: c.strictNames ?? false });

    if (c.chat) {
      const verdict = checkPrivacy(
        c.chat.message,
        { name: out.patient.name, mrn: out.patient.mrn },
        { known: samples.map((s) => ({ name: s.label, mrn: s.mrn, id: s.id })), source: reference.rules.find((r) => r.id === "privacy")?.source },
      );
      add("chat refused", c.chat.refused, !verdict.allowed);
      if (c.chat.refused) add("refusal cites the safety rules file", true, /safety_rules/.test(verdict.refusal ?? ""));
    }

    const e = c.expect;
    if (e.patient) {
      for (const [k, v] of Object.entries(e.patient)) add(`patient.${k}`, v, out.patient[k as keyof typeof out.patient]);
    }
    if (e.testCount !== undefined) add("number of tests found", e.testCount, out.results.length);
    if (e.urgent !== undefined) add("urgent flag", e.urgent, out.urgent);
    if (e.needsInfo) add("asks for", [...e.needsInfo].sort(), out.needsInfo.map((n) => n.field).sort());
    for (const t of e.tests ?? []) {
      const r = out.results.find((x) => x.canonicalName === t.name);
      if (!r) {
        add(`${t.name} found`, t.name, out.results.map((x) => x.canonicalName).join(", ") || "nothing");
        continue;
      }
      add(`${t.name} status`, t.status, r.status);
      if (t.direction) add(`${t.name} direction`, t.direction, r.direction);
      if (t.convertedValue !== undefined) add(`${t.name} converted value`, t.convertedValue, r.convertedValue);
      if (t.originalName) add(`${t.name} original name`, t.originalName, r.originalName);
      if (t.matchedBy) add(`${t.name} matched by`, t.matchedBy, r.matchedBy);
      if (r.status === "needs_info") add(`${t.name} carries a question`, true, Boolean(r.question && r.question.length > 10));
      if (r.status === "urgent") add(`${t.name} carries the doctor warning`, true, /see a doctor today/i.test(r.warning ?? ""));
      add(`${t.name} trace has steps`, true, r.trace.length >= 2);
    }
  } catch (err) {
    checks.push({ label: "runs without throwing", pass: false, want: "no error", got: err instanceof Error ? err.message : String(err) });
  }

  return { id: c.id, title: c.title, group: c.group, pass: checks.every((x) => x.pass), checks, ms: Math.round((performance.now() - started) * 100) / 100 };
}

export function runAllEvals(): { total: number; passed: number; failed: number; results: EvalResult[]; ms: number } {
  const started = performance.now();
  const results = EVAL_CASES.map(runEvalCase);
  const passed = results.filter((r) => r.pass).length;
  return { total: results.length, passed, failed: results.length - passed, results, ms: Math.round(performance.now() - started) };
}
