/**
 * Report parser (deterministic).
 * Extracts demographics and a list of { test, value, unit } from a lab report in
 * any of the layouts seen in the corpus, plus a few that are not:
 *
 *   list        "- Hemoglobin: 13.5 g/dL"   "* **WBC**: 12000 cells/mcL"
 *   arrow       "* pH Level -> 5.5"         "Hb = 13.5 g/dL"
 *   table       markdown tables with any header names, in any column order
 *   pair        "Test: AST" + "Result: 44 U/L", "Test Conducted" + "Value Recorded"
 *   columns     "Hemoglobin ........ 13.5 g/dL", tab or wide-space separated
 *   known-name  "Hemoglobin 13.5 g/dL" (only for names the reference files know)
 *
 * Nothing here knows about a specific patient or a specific sample file.
 */
import { cleanLines, type CleanLine } from "./cleaner";
import { config } from "./config";
import { isTableDivider, isTableRow, normName, splitTableRow, stripMarkdown } from "./text";
import type { ParsedReport, ParsedTest, Patient, Sex } from "./types";

const NAME_KEY = /^(?:patient(?:'s)?\s*)?(?:full\s*)?name$|^patient$|^name of (?:the )?patient$/i;
const AGE_KEY = /\bage\b/i;
const SEX_KEY = /\bsex\b|\bgender\b/i;
const MRN_KEY = /\bmrn\b|medical record|patient\s*(?:id|no|number)|record\s*(?:id|no|number)/i;
const META_KEY =
  /\bdate\b|\bissu|\bcollect|\breported\b|\breceived\b|\bdoctor\b|\bphysician\b|\breferr|\blab(?:oratory)?\b|\bspecimen\b|\bsample\b|\bphone\b|\baddress\b|\bdob\b|\bbirth\b|\bid\b|\bpage\b|\bversion\b|\bstatus\b|\bnote\b|\bremarks?\b|\bcomment/i;

const TEST_KEY = /^(?:test|tests?\s*name|test\s*(?:conducted|performed|done|ordered)|analyte(?:\s*name)?|parameter|investigation|examination|assay)$/i;
const VALUE_KEY = /^(?:result|results|value|result\s*value|value\s*(?:recorded|observed|measured)|(?:observed|measured|recorded)\s*value|reading|finding|outcome|level)$/i;
const UNIT_KEY = /^units?$|^unit of measure/i;

const TABLE_TEST_COL = /test|analyte|parameter|investigation|component|name|description|assay/i;
const TABLE_VALUE_COL = /result|value|observed|reading|finding|measure|level|outcome/i;
const TABLE_UNIT_COL = /unit/i;
const TABLE_IGNORE_COL = /range|reference|ref\b|normal|flag|status|interval|method/i;

const DEMOGRAPHIC_SECTION = /demograph|patient\s*(?:info|details|data|particulars)|encounter/i;

const PLACEHOLDER = /^\s*(?:\[.*\]|\(.*\)|<.*>|\{.*\}|n\/?a|none|nil|null|unknown|not\s+(?:provided|available|given|recorded|specified|stated)|missing|-+|_+|\?+|x+)?\s*$/i;

const VALUE_UNIT = /^(?:[A-Za-zµμ%]|x\s?10|10\^|\/)[A-Za-z0-9µμ%/^.*×]{0,15}(?:\s[A-Za-zµμ/][A-Za-z0-9µμ/^.]{0,8})?$/;

export function isPlaceholder(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return PLACEHOLDER.test(value);
}

export function parseAge(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 150 ? Math.floor(value) : null;
  if (isPlaceholder(value)) return null;
  const m = String(value)
    .trim()
    .match(/^(\d{1,3})(?:\.\d+)?\s*(?:years?|yrs?|y\.?o\.?|y\/o|y)?\.?(?:\s*old)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n <= 150 ? n : null;
}

/** Sex is only ever read from an explicit field. It is never inferred from a name. */
export function parseSex(value: string | null | undefined): Sex | null {
  if (isPlaceholder(value)) return null;
  const v = String(value).trim().toLowerCase().replace(/[.()]/g, "");
  if (/^(?:m|male|man|boy)$/.test(v)) return "male";
  if (/^(?:f|female|woman|girl)$/.test(v)) return "female";
  return null;
}

interface KeyValue {
  key: string;
  value: string;
  sep: string;
}

function splitKeyValue(text: string): KeyValue | null {
  const strong = text.match(/^(.{1,70}?)\s*(:|->|=>|→|=)\s*(.*)$/);
  if (strong) return { key: strong[1].trim(), value: strong[3].trim(), sep: strong[2] };
  const columns = text.match(/^(.{1,70}?)(?:\t+|\s{2,})(\S.*)$/);
  if (columns) return { key: columns[1].trim(), value: columns[2].trim(), sep: "columns" };
  const dash = text.match(/^(.{1,70}?)\s+[-–—]\s+(.*)$/);
  if (dash) return { key: dash[1].trim(), value: dash[2].trim(), sep: "-" };
  return null;
}

export interface ValueUnit {
  value: string;
  unit: string | null;
}

/** "13.5 g/dL (H)" -> { value: "13.5", unit: "g/dL" }. Returns null for anything that is not a result. */
export function parseValueUnit(raw: string): ValueUnit | null {
  let v = raw.replace(/\s+/g, " ").trim();
  if (!v) return null;
  v = v.replace(/\s*[\[(][^\])]*[\])]\s*$/, "").trim(); // trailing "(12.1 - 15.1)" reference note
  v = v.replace(/\s+\(?(?:HH|LL|H|L|high|low|normal|critical|abnormal)\)?\*?$/i, "").trim(); // trailing flag
  v = v.replace(/[.;,]+$/, "").trim();
  if (!v) return null;

  if (config.qualitativeWords.includes(v.toLowerCase())) return { value: v, unit: null };

  const m = v.match(/^((?:[<>]=?\s*)?[-+]?\d[\d,]*(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  const rest = m[2].trim();
  if (rest === "") return { value: m[1].trim(), unit: null };
  if (!VALUE_UNIT.test(rest) || !/[A-Za-zµμ%]/.test(rest)) return null;
  return { value: m[1].trim(), unit: rest };
}

function looksLikeTestName(key: string): boolean {
  if (!key || key.length > 50) return false;
  if (!/[A-Za-z]/.test(key)) return false;
  if (key.split(/\s+/).length > 6) return false;
  if (/[.!?]$/.test(key)) return false;
  if (NAME_KEY.test(key) || AGE_KEY.test(key) || SEX_KEY.test(key) || MRN_KEY.test(key) || META_KEY.test(key)) return false;
  if (TEST_KEY.test(key) || VALUE_KEY.test(key) || UNIT_KEY.test(key)) return false;
  return true;
}

export interface ParseOptions {
  /** Canonical names and aliases from the reference tables, used by the "known-name" layout. */
  knownNames?: string[];
}

export function parseReport(raw: string, options: ParseOptions = {}): ParsedReport {
  const lines = cleanLines(raw);
  const cleanedText = lines
    .map((l) => l.text)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const demo: { name: string | null; age: string | null; sex: string | null; mrn: string | null } = {
    name: null,
    age: null,
    sex: null,
    mrn: null,
  };
  const seen = { age: false, sex: false };
  const tests: ParsedTest[] = [];
  const notes: string[] = [];
  const known = [...(options.knownNames ?? [])].map(normName).filter(Boolean).sort((a, b) => b.length - a.length);

  const addTest = (name: string, vu: ValueUnit | null, layout: string, line: number) => {
    const cleanName = stripMarkdown(name).replace(/[:\s]+$/, "");
    if (!vu || !cleanName) return;
    if (tests.some((t) => normName(t.name) === normName(cleanName) && t.value === vu.value)) return;
    tests.push({ name: cleanName, value: vu.value, unit: vu.unit, layout, line });
  };

  /** Returns true when the key/value pair was a demographic or metadata field. */
  const takeDemographic = (key: string, value: string): boolean => {
    if (AGE_KEY.test(key) && SEX_KEY.test(key)) {
      // "Age/Sex: 28/F"
      const parts = value.split(/[\/,|]/).map((p) => p.trim());
      seen.age = seen.sex = true;
      demo.age ??= parts[0] ?? null;
      demo.sex ??= parts[1] ?? null;
      return true;
    }
    if (NAME_KEY.test(key)) {
      demo.name ??= value;
      return true;
    }
    if (MRN_KEY.test(key)) {
      demo.mrn ??= value;
      return true;
    }
    if (AGE_KEY.test(key) && key.length <= 40) {
      seen.age = true;
      demo.age ??= value;
      return true;
    }
    if (SEX_KEY.test(key) && key.length <= 40) {
      seen.sex = true;
      demo.sex ??= value;
      return true;
    }
    return META_KEY.test(key) && key.length <= 40;
  };

  let inDemographics = false;
  let pendingTest: { name: string; line: number } | null = null;
  let lastPair: ParsedTest | null = null;

  let i = 0;
  while (i < lines.length) {
    const { text, line } = lines[i];

    if (/^\s{0,3}#{1,6}\s/.test(text)) {
      inDemographics = DEMOGRAPHIC_SECTION.test(text);
      pendingTest = null;
      i++;
      continue;
    }

    // ---- markdown tables -------------------------------------------------
    if (isTableRow(text)) {
      const block: CleanLine[] = [];
      while (i < lines.length && isTableRow(lines[i].text)) block.push(lines[i++]);
      parseTableBlock(block, addTest, takeDemographic);
      continue;
    }
    i++;

    const plain = stripMarkdown(text.replace(/\s*\.{3,}\s*/g, ": "));
    if (!plain) continue;

    // Several "key: value" pairs on one line ("Age: 28 | Sex: F", "Test: AST, Result: 44 U/L").
    const segments = /[|;]|,\s*[A-Za-z ]{2,25}:/.test(plain)
      ? plain.split(/\s*[|;]\s*|,\s*(?=[A-Za-z ]{2,25}:)/).filter(Boolean)
      : [plain];

    for (const segment of segments) {
      const kv = splitKeyValue(segment);
      if (!kv) {
        const hit = matchKnownName(segment, known);
        if (hit && !inDemographics) addTest(hit.name, hit.vu, "known-name", line);
        continue;
      }
      const { key, value } = kv;

      if (takeDemographic(key, value)) continue;

      if (TEST_KEY.test(key)) {
        if (value) pendingTest = { name: value, line };
        continue;
      }
      if (VALUE_KEY.test(key)) {
        if (pendingTest) {
          const before = tests.length;
          addTest(pendingTest.name, parseValueUnit(value), "pair", pendingTest.line);
          lastPair = tests.length > before ? tests[tests.length - 1] : null;
          pendingTest = null;
        }
        continue;
      }
      if (UNIT_KEY.test(key)) {
        if (lastPair && !lastPair.unit && value) lastPair.unit = value;
        continue;
      }

      if (inDemographics) continue;
      if (!looksLikeTestName(key)) continue;
      const vu = parseValueUnit(value);
      if (!vu) continue;
      const layout = kv.sep === ":" ? "list" : kv.sep === "columns" ? "columns" : kv.sep === "-" ? "dash" : "arrow";
      addTest(key, vu, layout, line);
    }
  }

  const age = parseAge(demo.age);
  const sex = parseSex(demo.sex);
  const missing: Patient["missing"] = [];
  if (age === null) missing.push("age");
  if (sex === null) missing.push("sex");
  if (age === null && seen.age && demo.age && !isPlaceholder(demo.age)) notes.push(`Age value "${demo.age}" is not a readable number, treated as missing.`);
  if (sex === null && seen.sex && demo.sex && !isPlaceholder(demo.sex)) notes.push(`Sex value "${demo.sex}" is not male or female, treated as missing.`);

  const patient: Patient = {
    name: isPlaceholder(demo.name) ? null : demo.name,
    age,
    sex,
    mrn: isPlaceholder(demo.mrn) ? null : demo.mrn,
    missing,
  };

  return { patient, tests, cleanedText, extraction: tests.length > 0 ? "deterministic" : "none", notes };
}

function parseTableBlock(
  block: CleanLine[],
  addTest: (name: string, vu: ValueUnit | null, layout: string, line: number) => void,
  takeDemographic: (key: string, value: string) => boolean,
): void {
  const rows = block.filter((r) => !isTableDivider(r.text)).map((r) => ({ cells: splitTableRow(r.text), line: r.line }));
  if (rows.length === 0) return;

  const header = rows[0].cells.map((c) => c.toLowerCase());
  const hasHeader = block.length > 1 && isTableDivider(block[1].text);
  let testCol = -1;
  let valueCol = -1;
  let unitCol = -1;

  if (hasHeader) {
    unitCol = header.findIndex((h) => TABLE_UNIT_COL.test(h));
    valueCol = header.findIndex((h, idx) => idx !== unitCol && TABLE_VALUE_COL.test(h) && !TABLE_IGNORE_COL.test(h));
    testCol = header.findIndex((h, idx) => idx !== unitCol && idx !== valueCol && TABLE_TEST_COL.test(h) && !TABLE_IGNORE_COL.test(h));
  }
  const body = hasHeader ? rows.slice(1) : rows;

  if (testCol < 0 || valueCol < 0) {
    // Unknown header names: fall back to position. First column is the name,
    // the first later cell that parses as a result is the value.
    for (const r of body) {
      if (r.cells.length < 2) continue;
      const key = r.cells[0];
      if (r.cells.length === 2 && takeDemographic(key, r.cells[1])) continue;
      if (!looksLikeTestName(key)) continue;
      for (let c = 1; c < r.cells.length; c++) {
        const vu = parseValueUnit(r.cells[c]);
        if (!vu) continue;
        if (!vu.unit && r.cells[c + 1] && VALUE_UNIT.test(r.cells[c + 1]) && !parseValueUnit(r.cells[c + 1])) vu.unit = r.cells[c + 1];
        addTest(key, vu, "table", r.line);
        break;
      }
    }
    return;
  }

  for (const r of body) {
    const name = r.cells[testCol];
    if (!name) continue;
    const vu = parseValueUnit(r.cells[valueCol] ?? "");
    if (!vu) continue;
    if (!vu.unit && unitCol >= 0 && r.cells[unitCol] && !isPlaceholder(r.cells[unitCol])) vu.unit = r.cells[unitCol];
    addTest(name, vu, "table", r.line);
  }
}

/** "Hemoglobin 13.5 g/dL": no separator, so only accepted for names the reference files know. */
function matchKnownName(segment: string, known: string[]): { name: string; vu: ValueUnit } | null {
  const m = segment.match(/^([A-Za-z][A-Za-z .()\/-]*?)\s+((?:[<>]=?\s*)?[-+]?\d[\d,.]*\s*\S*(?:\s\S+)?)$/);
  if (!m) return null;
  const candidate = normName(m[1]);
  if (!known.includes(candidate)) return null;
  const vu = parseValueUnit(m[2]);
  return vu ? { name: m[1].trim(), vu } : null;
}
