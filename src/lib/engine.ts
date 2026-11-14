/**
 * Rules engine. Pure functions, no LLM, no I/O.
 *
 * For every test it runs, in this order:
 *   1. name resolution   exact -> glossary alias -> normalised -> context (optional)
 *   2. unit conversion   into the unit of the reference sheet, shown as a step
 *   3. urgent check      file 3 thresholds, inclusive ("hit or pass")
 *   4. range selection   by sex and age (inclusive bounds); asks when a needed field is missing
 *   5. classification    a value exactly on a limit is NORMAL (rule in file 4)
 *
 * Every step is written to a trace with the file and line it relied on.
 */
import { config } from "./config";
import { formatNumber, normName, parseNumber, round } from "./text";
import type {
  Conversion,
  EngineOutput,
  NeedsInfo,
  ParsedTest,
  Patient,
  RangeRow,
  RangeUsed,
  ReferenceTables,
  RuleRef,
  SourceRef,
  Status,
  TestResult,
  TraceStep,
  UrgentRow,
} from "./types";

export interface EngineOptions {
  /** Overrides config.strictNames (used by tests and the /evals page). */
  strictNames?: boolean;
  /** Free text that describes the report (cleaned text, file name). Used only for context matching. */
  contextText?: string;
}

function rule(tables: ReferenceTables, id: RuleRef["id"]): RuleRef | undefined {
  return tables.rules.find((r) => r.id === id);
}

// ---------------------------------------------------------------------------
// 1. Name resolution
// ---------------------------------------------------------------------------

function canonicalNames(tables: ReferenceTables): string[] {
  const names = new Map<string, string>();
  for (const r of tables.ranges) names.set(normName(r.test), r.test);
  for (const u of tables.urgent) if (!names.has(normName(u.test))) names.set(normName(u.test), u.test);
  return [...names.values()];
}

/** Every name the reference files know: canonical names plus aliases. */
export function knownTestNames(tables: ReferenceTables): string[] {
  return [...canonicalNames(tables), ...tables.aliases.map((a) => a.alias), ...tables.aliases.map((a) => a.canonical)];
}

/** "Platelets" and "Platelet Count" share the core "platelet". */
function coreTokens(name: string, extraFillers: string[] = []): string[] {
  const fillers = new Set([...config.nameFillerWords, "count", "total", ...extraFillers]);
  return normName(name)
    .split(" ")
    .filter((t) => t && !fillers.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

const core = (name: string, extra: string[] = []) => coreTokens(name, extra).join(" ");

function nameVariants(name: string): string[] {
  const variants = [name];
  const paren = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    if (paren[1].trim()) variants.push(paren[1].trim());
    variants.push(paren[2].trim());
  }
  return variants;
}

export interface NameResolution {
  canonical: string;
  matchedBy: TestResult["matchedBy"];
  steps: TraceStep[];
  /** Set when the name could only be matched if the report context confirms a specimen. */
  contextCandidate?: { canonical: string; qualifier: string; source: SourceRef };
}

export function resolveName(name: string, tables: ReferenceTables, strict: boolean): NameResolution {
  const canon = canonicalNames(tables);
  const canonByKey = new Map(canon.map((c) => [normName(c), c]));

  for (const variant of nameVariants(name)) {
    const key = normName(variant);
    const exact = canonByKey.get(key);
    if (exact) {
      return {
        canonical: exact,
        matchedBy: "exact",
        steps: [{ step: "alias", detail: `"${name}" is a test name used in the reference sheets as "${exact}". No alias needed.` }],
      };
    }
    const alias = tables.aliases.find((a) => normName(a.alias) === key);
    if (alias) {
      const target = canonByKey.get(normName(alias.canonical)) ?? alias.canonical;
      return {
        canonical: target,
        matchedBy: "alias",
        steps: [
          {
            step: "alias",
            detail: `"${name}" is listed in the glossary as an alias of "${target}" (matched without regard to letter case).`,
            source: alias.source,
          },
        ],
      };
    }
  }

  if (!strict) {
    // Normalised match: plural, "count", "level", "total" carry no meaning.
    const wanted = core(name);
    if (wanted) {
      const hits = new Map<string, { canonical: string; via: string; source?: SourceRef }>();
      for (const c of canon) if (core(c) === wanted) hits.set(c, { canonical: c, via: c });
      for (const a of tables.aliases) {
        if (core(a.alias) === wanted || core(a.canonical) === wanted) {
          const target = canonByKey.get(normName(a.canonical)) ?? a.canonical;
          if (!hits.has(target)) hits.set(target, { canonical: target, via: a.alias, source: a.source });
        }
      }
      if (hits.size === 1) {
        const hit = [...hits.values()][0];
        return {
          canonical: hit.canonical,
          matchedBy: "normalized",
          steps: [
            {
              step: "alias",
              detail: `"${name}" is not written exactly as in the files. Matched to "${hit.canonical}" after ignoring plural endings and filler words (count, level, total). Turn on strict mode to disable this.`,
              source: hit.source,
            },
          ],
        };
      }

      // Context candidate: "pH Level" could be "Urine pH" if the report is a urine report.
      const hasSpecimen = normName(name)
        .split(" ")
        .some((t) => config.specimenWords.includes(t));
      if (!hasSpecimen) {
        const candidates = canon.filter((c) => {
          const first = normName(c).split(" ")[0];
          return config.specimenWords.includes(first) && core(c, [first]) === wanted;
        });
        if (candidates.length === 1) {
          const canonical = candidates[0];
          const source = tables.ranges.find((r) => r.test === canonical)?.source ?? tables.urgent.find((u) => u.test === canonical)!.source;
          return {
            canonical: name,
            matchedBy: "none",
            steps: [],
            contextCandidate: { canonical, qualifier: normName(canonical).split(" ")[0], source },
          };
        }
      }
    }
  }

  return { canonical: name, matchedBy: "none", steps: [] };
}

// ---------------------------------------------------------------------------
// 2. Units
// ---------------------------------------------------------------------------

export function normUnit(unit: string | null | undefined): string {
  if (!unit) return "";
  const u = unit
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[µμ]/g, "mc")
    .replace(/×/g, "x")
    .replace(/\*\*/g, "^");
  return config.unitSynonyms[u] ?? u;
}

export type UnitOutcome =
  | { ok: true; value: number; unit: string | null; conversion: Conversion | null; assumed: boolean }
  | { ok: false; reason: string };

export function toReferenceUnit(value: number, unit: string | null, refUnit: string | null, canonical: string): UnitOutcome {
  if (!refUnit) return { ok: true, value, unit: unit, conversion: null, assumed: false };
  if (!unit) return { ok: true, value, unit: refUnit, conversion: null, assumed: true };
  const from = normUnit(unit);
  const to = normUnit(refUnit);
  if (from === to) return { ok: true, value, unit: refUnit, conversion: null, assumed: false };

  for (const c of config.conversions) {
    const applies = c.tests === "any" || c.tests.some((t) => normName(t) === normName(canonical));
    if (!applies) continue;
    let factor: number | null = null;
    if (c.from === from && c.to === to) factor = c.factor;
    else if (c.from === to && c.to === from) factor = 1 / c.factor;
    if (factor === null) continue;
    const converted = round(value * factor);
    const forward = c.from === from;
    return {
      ok: true,
      value: converted,
      unit: refUnit,
      assumed: false,
      conversion: {
        fromValue: value,
        fromUnit: unit,
        toValue: converted,
        toUnit: refUnit,
        factor: forward ? c.factor : round(1 / c.factor),
        formula: forward
          ? `${formatNumber(value)} ${unit} x ${c.factor} = ${formatNumber(converted)} ${refUnit}`
          : `${formatNumber(value)} ${unit} / ${c.factor} = ${formatNumber(converted)} ${refUnit}`,
        basis: c.basis,
      },
    };
  }
  return { ok: false, reason: `the unit "${unit}" cannot be converted to "${refUnit}"` };
}

// ---------------------------------------------------------------------------
// 3. Urgent check
// ---------------------------------------------------------------------------

/** Inclusive on purpose: file 3 says "hit or pass these specific thresholds". */
export function isUrgent(value: number, row: UrgentRow): boolean {
  return row.direction === "low" ? value <= row.threshold : value >= row.threshold;
}

// ---------------------------------------------------------------------------
// 4 + 5. Range selection and classification
// ---------------------------------------------------------------------------

export function classifyAgainstRange(value: number, low: number | null, high: number | null): "low" | "high" | "normal" {
  if (low !== null && value < low) return "low";
  if (high !== null && value > high) return "high";
  return "normal";
}

function tubePosition(value: number, low: number | null, high: number | null): number | null {
  if (low === null || high === null || high <= low) return null;
  const p = 0.25 + (0.5 * (value - low)) / (high - low);
  return round(Math.min(0.96, Math.max(0.04, p)), 3);
}

function describeRange(r: RangeUsed): string {
  const who = `${r.sex === "all" ? "all sexes" : r.sex}, age ${r.ageMin}-${r.ageMax}`;
  if (r.qualitative) return `${r.qualitative} (${who})`;
  const unit = r.unit ? ` ${r.unit}` : "";
  if (r.low !== null && r.high !== null) return `${formatNumber(r.low)} - ${formatNumber(r.high)}${unit} (${who})`;
  if (r.high !== null) return `up to ${formatNumber(r.high)}${unit} (${who})`;
  return `${formatNumber(r.low!)}${unit} or more (${who})`;
}

function questionFor(test: string, missing: Array<"age" | "sex">): string {
  const parts = missing.map((m) => (m === "age" ? "the patient's age in years" : "the patient's biological sex (male or female)"));
  return `I cannot choose the right normal range for ${test} without ${parts.join(" and ")}. Please tell me ${parts.join(" and ")}.`;
}

interface Context {
  tables: ReferenceTables;
  patient: Patient;
  strict: boolean;
}

function baseResult(test: ParsedTest, canonical: string, matchedBy: TestResult["matchedBy"], trace: TraceStep[]): TestResult {
  const numeric = parseNumber(test.value.replace(/^[<>]=?\s*/, ""));
  return {
    canonicalName: canonical,
    originalName: test.name,
    value: numeric ?? test.value,
    rawValue: test.value,
    unit: test.unit,
    convertedValue: null,
    convertedUnit: null,
    conversion: null,
    rangeUsed: null,
    status: "unclassified",
    direction: null,
    urgent: false,
    warning: null,
    question: null,
    missingFields: [],
    summary: "",
    position: null,
    matchedBy,
    trace,
  };
}

function finish(result: TestResult): TestResult {
  const shown = `${result.rawValue}${result.unit ? " " + result.unit : ""}`;
  const converted = result.conversion ? ` (= ${formatNumber(result.conversion.toValue)} ${result.conversion.toUnit})` : "";
  const name = result.canonicalName === result.originalName ? result.canonicalName : `${result.canonicalName} (reported as ${result.originalName})`;
  const range = result.rangeUsed ? ` Range used: ${describeRange(result.rangeUsed)}, from ${result.rangeUsed.source.file}.` : "";
  switch (result.status) {
    case "normal":
      result.summary = `${name}: ${shown}${converted} is NORMAL.${range}`;
      break;
    case "low":
    case "high":
      result.summary = `${name}: ${shown}${converted} is ${result.status.toUpperCase()}.${range}`;
      break;
    case "abnormal":
      result.summary = `${name}: ${shown} is ABNORMAL.${range}`;
      break;
    case "urgent":
      result.summary = `${name}: ${shown}${converted} is URGENT (${result.direction === "low" ? "dangerously low" : "dangerously high"}). ${config.phrases.urgentWarning}${range}`;
      break;
    case "needs_info":
      result.summary = `${name}: ${shown}${converted} is not classified yet. ${result.question}`;
      break;
    default:
      result.summary = `${name}: ${shown} ${config.phrases.unclassified}.`;
  }
  return result;
}

function unclassified(result: TestResult, reason: string, tables: ReferenceTables): TestResult {
  const r = rule(tables, "unknown_tests");
  result.status = "unclassified";
  result.trace.push({
    step: "classify",
    detail: `Result: ${config.phrases.unclassified}. Reason: ${reason}.`,
    source: r?.source,
  });
  return finish(result);
}

export function classifyTest(test: ParsedTest, resolution: NameResolution, ctx: Context): TestResult {
  const { tables } = ctx;
  const trace: TraceStep[] = [
    {
      step: "parse",
      detail: `Read "${test.name}" = ${test.value}${test.unit ? " " + test.unit : ""} from the report (layout: ${test.layout}, line ${test.line}).`,
    },
    ...resolution.steps,
  ];
  const canonical = resolution.canonical;
  const result = baseResult(test, canonical, resolution.matchedBy, trace);

  const ranges = tables.ranges.filter((r) => normName(r.test) === normName(canonical));
  const urgentRows = tables.urgent.filter((u) => normName(u.test) === normName(canonical));

  if (resolution.matchedBy === "none") {
    return unclassified(result, `"${test.name}" is not a test name or alias in the glossary or range sheets`, tables);
  }
  if (ranges.length === 0 && urgentRows.length === 0) {
    return unclassified(result, `"${canonical}" is in the glossary but no reference sheet gives a range for it`, tables);
  }

  // ---- qualitative tests (for example Urine Protein: Negative) -------------
  const numeric = parseNumber(test.value.replace(/^[<>]=?\s*/, ""));
  const qualitativeRanges = ranges.filter((r) => r.qualitative);
  if (qualitativeRanges.length > 0 && ranges.every((r) => r.qualitative)) {
    const picked = pickRange(result, qualitativeRanges, ctx);
    if (!picked) return finish(result);
    result.rangeUsed = picked;
    const same = normName(String(test.value)) === normName(picked.qualitative!);
    result.status = same ? "normal" : "abnormal";
    trace.push({
      step: "classify",
      detail: same
        ? `The report says "${test.value}" and the expected result is "${picked.qualitative}". Result: NORMAL.`
        : `The report says "${test.value}" but the expected result is "${picked.qualitative}". Result: ABNORMAL.`,
      source: picked.source,
    });
    return finish(result);
  }

  if (numeric === null) {
    return unclassified(result, `the value "${test.value}" is not a number, and "${canonical}" has a numeric range`, tables);
  }
  if (/^[<>]/.test(test.value)) {
    trace.push({ step: "note", detail: `The report gives "${test.value}". The number ${formatNumber(numeric)} is used for comparison.` });
  }

  // ---- unit ---------------------------------------------------------------
  const refUnit = ranges.find((r) => r.unit)?.unit ?? urgentRows.find((u) => u.unit)?.unit ?? null;
  const unitOutcome = toReferenceUnit(numeric, test.unit, refUnit, canonical);
  if (!unitOutcome.ok) {
    trace.push({ step: "unit", detail: `The reference sheets use ${refUnit} for ${canonical}; ${unitOutcome.reason}.` });
    return unclassified(result, unitOutcome.reason, tables);
  }
  const value = unitOutcome.value;
  if (unitOutcome.conversion) {
    result.conversion = unitOutcome.conversion;
    result.convertedValue = unitOutcome.conversion.toValue;
    result.convertedUnit = unitOutcome.conversion.toUnit;
    trace.push({
      step: "conversion",
      detail: `Unit conversion: ${unitOutcome.conversion.formula}. Basis: ${unitOutcome.conversion.basis}.`,
    });
  } else if (unitOutcome.assumed) {
    trace.push({
      step: "unit",
      detail: `The report gives no unit. The value is compared as ${refUnit}, the unit of the reference sheet. Check the unit on the paper report.`,
    });
  } else if (refUnit) {
    trace.push({ step: "unit", detail: `Unit ${test.unit} matches the reference unit ${refUnit}. No conversion needed.` });
  } else {
    trace.push({ step: "unit", detail: `${canonical} has no unit in the reference sheet. No conversion needed.` });
  }

  // ---- urgent check (after conversion, before demographics) ----------------
  const urgentWording = rule(tables, "urgent_wording");
  let urgentHit: UrgentRow | null = null;
  for (const row of urgentRows) {
    const forUrgent = row.unit && refUnit && normUnit(row.unit) !== normUnit(refUnit) ? toReferenceUnit(value, refUnit, row.unit, canonical) : null;
    if (forUrgent && !forUrgent.ok) continue;
    const comparable = forUrgent && forUrgent.ok ? forUrgent.value : value;
    const hit = isUrgent(comparable, row);
    trace.push({
      step: "urgent",
      detail: hit
        ? `Urgent check: ${formatNumber(comparable)} ${row.direction === "low" ? "<=" : ">="} ${formatNumber(row.threshold)} ${row.unit ?? ""} ("${row.comparatorText}" in the file, and the file says "hit or pass", so a value equal to the threshold counts). URGENT.`
        : `Urgent check: threshold is "${row.comparatorText} ${formatNumber(row.threshold)} ${row.unit ?? ""}". ${formatNumber(comparable)} does not reach it.`,
      source: row.source,
    });
    if (hit) urgentHit = row;
  }
  if (urgentHit) {
    result.urgent = true;
    result.direction = urgentHit.direction;
    result.warning = `${canonical} is ${urgentHit.direction === "low" ? "dangerously low" : "dangerously high"}. ${config.phrases.urgentWarning}`;
    if (urgentWording) trace.push({ step: "note", detail: `Rule applied: "${urgentWording.text}"`, source: urgentWording.source });
  }

  // ---- range selection ----------------------------------------------------
  const picked = ranges.length > 0 ? pickRange(result, ranges, ctx, urgentHit !== null) : null;
  if (picked) {
    result.rangeUsed = picked;
    result.position = tubePosition(value, picked.low, picked.high);
    const verdict = classifyAgainstRange(value, picked.low, picked.high);
    const onLimit = value === picked.low || value === picked.high;
    const boundary = rule(tables, "boundary");
    trace.push({
      step: "classify",
      detail:
        verdict === "normal"
          ? onLimit
            ? `${formatNumber(value)} sits exactly on a range limit. The files say a value on the limit is NORMAL.`
            : `${formatNumber(value)} is inside ${describeRange(picked)}. Result: NORMAL.`
          : `${formatNumber(value)} is ${verdict === "low" ? "below" : "above"} ${describeRange(picked)}. Result: ${verdict.toUpperCase()}.`,
      source: onLimit && boundary ? boundary.source : picked.source,
    });
    if (!urgentHit) {
      result.status = verdict;
      result.direction = verdict === "normal" ? null : verdict;
    }
  }

  if (urgentHit) {
    result.status = "urgent";
    result.question = null;
    return finish(result);
  }
  if (!picked) return finish(result); // pickRange already set needs_info or unclassified
  return finish(result);
}

/**
 * Chooses the range row for this patient. Sets needs_info / unclassified on the
 * result and returns null when no row can be chosen.
 */
function pickRange(result: TestResult, ranges: RangeRow[], ctx: Context, alreadyUrgent = false): RangeUsed | null {
  const { tables, patient } = ctx;
  const trace = result.trace;
  const needsSex = ranges.some((r) => r.sex !== "all");
  const needsAge = ranges.some((r) => r.ageMin > 0 || r.ageMax < 200);

  const missing: Array<"age" | "sex"> = [];
  if (needsAge && patient.age === null) missing.push("age");
  if (needsSex && patient.sex === null) missing.push("sex");

  if (missing.length > 0) {
    const r = rule(tables, "missing_demographics");
    result.missingFields = missing;
    result.question = questionFor(result.canonicalName, missing);
    if (!alreadyUrgent) result.status = "needs_info";
    trace.push({
      step: "demographics",
      detail: `The range for ${result.canonicalName} depends on ${missing.join(" and ")}, which ${missing.length > 1 ? "are" : "is"} missing from the report. Nothing is guessed (sex is never inferred from a name). The user is asked instead.`,
      source: r?.source ?? ranges[0].source,
    });
    return null;
  }

  const match = ranges.find(
    (r) =>
      (r.sex === "all" || r.sex === patient.sex) &&
      (patient.age === null || (patient.age >= r.ageMin && patient.age <= r.ageMax)),
  );
  if (!match) {
    const spans = [...new Set(ranges.map((r) => `${r.ageMin}-${r.ageMax}`))].join(", ");
    const r = rule(tables, "unknown_tests");
    if (!alreadyUrgent) result.status = "unclassified";
    trace.push({
      step: "range",
      detail: `No range in the files covers a ${patient.sex ?? "patient"} aged ${patient.age}. The sheets only cover ages ${spans} (bounds inclusive). Result: ${config.phrases.unclassified}.`,
      source: r?.source ?? ranges[0].source,
    });
    return null;
  }

  const used: RangeUsed = {
    low: match.low,
    high: match.high,
    qualitative: match.qualitative,
    unit: match.unit,
    sex: match.sex,
    ageMin: match.ageMin,
    ageMax: match.ageMax,
    source: match.source,
  };
  const who = [
    needsSex ? `sex ${patient.sex}` : "any sex",
    needsAge ? `age ${patient.age} (inside ${match.ageMin}-${match.ageMax}, bounds inclusive)` : "any age",
  ].join(", ");
  trace.push({ step: "range", detail: `Range chosen for ${who}: ${describeRange(used)}.`, source: match.source });
  return used;
}

// ---------------------------------------------------------------------------
// Report level
// ---------------------------------------------------------------------------

export function runEngine(tests: ParsedTest[], patient: Patient, tables: ReferenceTables, options: EngineOptions = {}): EngineOutput {
  const strict = options.strictNames ?? config.strictNames;
  const ctx: Context = { tables, patient, strict };
  const contextText = (options.contextText ?? "").toLowerCase();

  const resolutions = tests.map((t) => resolveName(t.name, tables, strict));

  // Context matching ("pH Level" -> "Urine pH"). Two ways the context can say "urine":
  //   explicit: the report text or file name mentions the specimen
  //   panel:    every test in the report is a candidate for the same specimen, and there are at least two
  if (!strict) {
    const candidates = resolutions.filter((r) => r.contextCandidate);
    const qualifiers = new Set(candidates.map((r) => r.contextCandidate!.qualifier));
    const panel = candidates.length >= 2 && candidates.length === resolutions.length && qualifiers.size === 1;
    for (const r of candidates) {
      const c = r.contextCandidate!;
      const stem = c.qualifier.replace(/e$/, "");
      const explicit = contextText.includes(stem);
      if (!explicit && !panel) continue;
      r.canonical = c.canonical;
      r.matchedBy = "context";
      r.steps = [
        {
          step: "context",
          detail: explicit
            ? `Matched by context: the name is not in the glossary, but the report mentions "${stem}" and "${c.canonical}" is the only ${c.qualifier} test with this name in the range sheets. Turn on strict mode to disable this.`
            : `Matched by context: the name is not in the glossary, but every test in this report only fits the ${c.qualifier} tests in the range sheets, so it is read as "${c.canonical}". Turn on strict mode to disable this.`,
          source: c.source,
        },
      ];
    }
  }

  const results = tests.map((t, i) => classifyTest(t, resolutions[i], ctx));

  const urgentResults = results.filter((r) => r.urgent);
  const needsInfo: NeedsInfo[] = [];
  const demoRule = rule(tables, "missing_demographics");
  for (const field of patient.missing) {
    const blocking = results.filter((r) => r.missingFields.includes(field)).map((r) => r.canonicalName);
    const label = field === "age" ? "age in years" : "biological sex (male or female)";
    needsInfo.push({
      field,
      blocking,
      question:
        blocking.length > 0
          ? `The report does not give the patient's ${label}. I need it to choose the right normal range for ${blocking.join(", ")}. What is the patient's ${label}?`
          : `The report does not give the patient's ${label}. It was not needed for the tests above, but please confirm it if you can.`,
      source: demoRule?.source ?? null,
    });
  }

  const trace: TraceStep[] = [];
  const demo = [
    `name ${patient.name ?? "missing"}`,
    `age ${patient.age ?? "missing"}`,
    `sex ${patient.sex ?? "missing"}`,
    `MRN ${patient.mrn ?? "missing"}`,
  ].join(", ");
  trace.push({ step: "demographics", detail: `Demographics read from the report: ${demo}.` });
  trace.push({ step: "parse", detail: `${tests.length} test result${tests.length === 1 ? "" : "s"} found.` });
  if (strict) trace.push({ step: "note", detail: "Strict name mode is ON: only exact names and glossary aliases are accepted." });

  return {
    patient,
    results,
    urgent: urgentResults.length > 0,
    urgentMessage:
      urgentResults.length > 0
        ? `URGENT: ${urgentResults.map((r) => `${r.canonicalName} is ${r.direction === "low" ? "dangerously low" : "dangerously high"}`).join("; ")}. ${config.phrases.urgentWarning}`
        : null,
    needsInfo,
    trace,
  };
}

export type { Status };
