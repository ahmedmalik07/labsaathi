/**
 * Reference loader.
 * Turns the reference sheets in lab_reports/ (glossary, urgent values, range
 * sheets, safety rules) into typed tables. It is layout-driven, not
 * file-name-driven: any markdown table or bullet list in the right shape is
 * picked up, and every row remembers the file and line it came from.
 *
 * No number in this file is a medical value. They all come from the corpus.
 */
import { cleanLines, type CleanLine } from "./cleaner";
import { isTableDivider, isTableRow, normName, parseNumber, splitTableRow, stripMarkdown } from "./text";
import type { AliasRow, RangeRow, RangeSex, ReferenceTables, RuleRef, UrgentRow } from "./types";

export interface CorpusFile {
  name: string;
  text: string;
}

const NUM = String.raw`[-+]?\d[\d,]*(?:\.\d+)?`;
const UNIT_OK = /^[A-Za-zµμ%][A-Za-z0-9µμ%/^.]*$/;

const ALIAS_SENTENCE = new RegExp(
  String.raw`\*\*([^*]+)\*\*\s+(?:is\s+(?:the\s+)?(?:exact\s+)?equivalent\s+(?:of|to)|maps\s+to|stands\s+for|is\s+also\s+known\s+as|refers\s+to|means)\s+\*\*([^*]+)\*\*(?:\s*\(([^)]+)\))?`,
  "i",
);

function cleanUnit(raw: string | undefined): string | null {
  if (!raw) return null;
  const u = raw.replace(/[.,;:)]+$/, "").trim();
  return UNIT_OK.test(u) ? u : null;
}

function parseSex(text: string): RangeSex | null {
  if (/\bfemales?\b|\bwomen\b/i.test(text)) return "female";
  if (/\bmales?\b|\bmen\b/i.test(text)) return "male";
  if (/\ball\b|\bboth\b|\bany\b|\beither\b/i.test(text)) return "all";
  return null;
}

interface RangeSpec {
  sex: RangeSex;
  ageMin: number;
  ageMax: number;
  low: number | null;
  high: number | null;
  qualitative: string | null;
  unit: string | null;
}

const AGE_SPAN = /(\d{1,3})\s*(?:-|–|—|to)\s*(\d{1,3})\s*(?:yrs?|years?|y\/o|yo)\b\.?/i;

/** Parses "Male Demographic (18-100 yrs): 13.8 - 17.2 g/dL" style fragments. */
export function parseRangeSpec(fragment: string): RangeSpec | null {
  let text = stripMarkdown(fragment);
  const sex = parseSex(text) ?? "all";
  let ageMin = 0;
  let ageMax = 200;
  const age = text.match(AGE_SPAN);
  if (age) {
    ageMin = Number(age[1]);
    ageMax = Number(age[2]);
    text = text.replace(AGE_SPAN, " ");
  }

  const span = text.match(new RegExp(String.raw`(${NUM})\s*(?:-|–|—|to)\s*(${NUM})(?:\s*([^\s(,;]+))?`));
  if (span) {
    const low = parseNumber(span[1]);
    const high = parseNumber(span[2]);
    if (low !== null && high !== null) {
      return { sex, ageMin, ageMax, low, high, qualitative: null, unit: cleanUnit(span[3]) };
    }
  }
  const upper = text.match(new RegExp(String.raw`(?:<=?|≤|less than|up to|below|under)\s*(${NUM})(?:\s*([^\s(,;]+))?`, "i"));
  if (upper) {
    const high = parseNumber(upper[1]);
    if (high !== null) return { sex, ageMin, ageMax, low: null, high, qualitative: null, unit: cleanUnit(upper[2]) };
  }
  const lower = text.match(new RegExp(String.raw`(?:>=?|≥|greater than|above|over|at least)\s*(${NUM})(?:\s*([^\s(,;]+))?`, "i"));
  if (lower) {
    const low = parseNumber(lower[1]);
    if (low !== null) return { sex, ageMin, ageMax, low, high: null, qualitative: null, unit: cleanUnit(lower[2]) };
  }

  // Qualitative: the word(s) after the colon, before any bracket.
  const afterColon = text.includes(":") ? text.slice(text.indexOf(":") + 1) : text;
  const word = afterColon.replace(/\(.*$/, "").replace(/[.;,]+$/, "").trim();
  if (word && /^[A-Za-z][A-Za-z -]{1,30}$/.test(word)) {
    return { sex, ageMin, ageMax, low: null, high: null, qualitative: word, unit: null };
  }
  return null;
}

/** "Hemoglobin (Hb)" -> { name: "Hemoglobin", alias: "Hb" } */
function splitNameAlias(raw: string): { name: string; alias: string | null } {
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m && m[1].trim()) return { name: m[1].trim(), alias: m[2].trim() };
  return { name: raw.trim(), alias: null };
}

function findColumn(headers: string[], include: RegExp, exclude?: RegExp): number {
  return headers.findIndex((h) => include.test(h) && !(exclude && exclude.test(h)));
}

function parseTables(file: string, lines: CleanLine[], out: ReferenceTables): void {
  let i = 0;
  while (i < lines.length) {
    if (!isTableRow(lines[i].text) || i + 1 >= lines.length || !isTableDivider(lines[i + 1].text)) {
      i++;
      continue;
    }
    const headers = splitTableRow(lines[i].text).map((h) => h.toLowerCase());
    const rows: Array<{ cells: string[]; line: number }> = [];
    let j = i + 2;
    while (j < lines.length && isTableRow(lines[j].text)) {
      rows.push({ cells: splitTableRow(lines[j].text), line: lines[j].line });
      j++;
    }
    i = j;

    const testCol = findColumn(headers, /analyte|test|parameter|investigation|name/);
    const unitCol = findColumn(headers, /unit/);
    const ageMinCol = findColumn(headers, /age.*(min|from|low)|(min|from|low).*age/);
    const ageMaxCol = findColumn(headers, /age.*(max|to|high|upp)|(max|to|high|upp).*age/);
    const sexCol = findColumn(headers, /sex|gender/);
    const lowCol = findColumn(headers, /min|low/, /age/);
    const highCol = findColumn(headers, /max|high|upper/, /age/);
    const thresholdCol = findColumn(headers, /threshold/);
    const triggerCol = findColumn(headers, /condition|trigger|comparator|direction|when/);
    const aliasCol = findColumn(headers, /alias|abbrev|short|synonym/);
    const canonicalCol = findColumn(headers, /canonical|standard name|full name|maps to|equivalent/);

    if (testCol >= 0 && thresholdCol >= 0 && triggerCol >= 0) {
      for (const r of rows) {
        const threshold = parseNumber(r.cells[thresholdCol] ?? "");
        const trigger = r.cells[triggerCol] ?? "";
        const direction = /less|below|under|lower|<|≤/i.test(trigger)
          ? "low"
          : /greater|more|above|over|higher|>|≥/i.test(trigger)
            ? "high"
            : null;
        if (threshold === null || !direction || !r.cells[testCol]) continue;
        const { name, alias } = splitNameAlias(r.cells[testCol]);
        if (alias) out.aliases.push({ alias, canonical: name, source: { file, line: r.line } });
        out.urgent.push({
          test: name,
          direction,
          comparatorText: trigger,
          threshold,
          unit: unitCol >= 0 ? cleanUnit(r.cells[unitCol]) : null,
          source: { file, line: r.line },
        });
      }
    } else if (testCol >= 0 && lowCol >= 0 && highCol >= 0) {
      for (const r of rows) {
        if (!r.cells[testCol]) continue;
        const { name, alias } = splitNameAlias(r.cells[testCol]);
        if (alias) out.aliases.push({ alias, canonical: name, source: { file, line: r.line } });
        const low = parseNumber(r.cells[lowCol] ?? "");
        const high = parseNumber(r.cells[highCol] ?? "");
        const qualitative =
          low === null && high === null && /^[A-Za-z][A-Za-z -]*$/.test(r.cells[lowCol] ?? "") ? r.cells[lowCol] : null;
        if (low === null && high === null && !qualitative) continue;
        out.ranges.push({
          test: name,
          sex: sexCol >= 0 ? (parseSex(r.cells[sexCol] ?? "") ?? "all") : "all",
          ageMin: ageMinCol >= 0 ? (parseNumber(r.cells[ageMinCol] ?? "") ?? 0) : 0,
          ageMax: ageMaxCol >= 0 ? (parseNumber(r.cells[ageMaxCol] ?? "") ?? 200) : 200,
          low,
          high,
          qualitative,
          unit: unitCol >= 0 ? cleanUnit(r.cells[unitCol]) : null,
          source: { file, line: r.line },
        });
      }
    } else if (aliasCol >= 0 && canonicalCol >= 0) {
      for (const r of rows) {
        const alias = r.cells[aliasCol];
        const canonical = r.cells[canonicalCol];
        if (alias && canonical) out.aliases.push({ alias, canonical, source: { file, line: r.line } });
      }
    }
  }
}

function parseBullets(file: string, lines: CleanLine[], out: ReferenceTables): void {
  let currentTest: { name: string; indent: number } | null = null;

  for (const { text, line } of lines) {
    if (isTableRow(text)) continue;

    const aliasMatch = text.match(ALIAS_SENTENCE);
    if (aliasMatch) {
      const alias = aliasMatch[1].trim();
      const canonical = aliasMatch[2].trim();
      out.aliases.push({ alias, canonical, source: { file, line } });
      if (aliasMatch[3]) out.aliases.push({ alias: aliasMatch[3].trim(), canonical, source: { file, line } });
      continue;
    }

    const bullet = text.match(/^(\s*)[-*+•]\s+(.*)$/);
    if (!bullet) {
      if (text.trim() !== "") currentTest = null;
      continue;
    }
    const indent = bullet[1].length;
    const body = bullet[2];

    // "* **Hemoglobin (Hb)**:" opens a test block; the ranges follow as sub-bullets.
    const header = body.match(/^\*\*([^*]+)\*\*\s*:?\s*$/);
    if (header) {
      const { name, alias } = splitNameAlias(header[1]);
      currentTest = { name, indent };
      if (alias) out.aliases.push({ alias, canonical: name, source: { file, line } });
      continue;
    }

    // "* **TSH**: 0.4 - 4.0 mIU/L (Applicable to All sexes, 18-100 yrs)."
    const inline = body.match(/^\*\*([^*]+)\*\*\s*:\s*(.+)$/);
    if (inline) {
      const { name, alias } = splitNameAlias(inline[1]);
      const spec = parseRangeSpec(": " + inline[2]);
      if (spec) {
        if (alias) out.aliases.push({ alias, canonical: name, source: { file, line } });
        out.ranges.push({ test: name, ...spec, source: { file, line } });
      }
      currentTest = null;
      continue;
    }

    if (currentTest && indent > currentTest.indent) {
      const spec = parseRangeSpec(body);
      if (spec) out.ranges.push({ test: currentTest.name, ...spec, source: { file, line } });
      continue;
    }
    currentTest = null;
  }
}

const RULE_PATTERNS: Array<{ id: RuleRef["id"]; pattern: RegExp }> = [
  { id: "privacy", pattern: /never disclose another patient|context-lock/i },
  { id: "no_diagnosis", pattern: /no diagnostic authority|only a licensed medical doctor/i },
  { id: "missing_demographics", pattern: /missing demographics|do not guess/i },
  { id: "unknown_tests", pattern: /cannot be classified from the files/i },
  { id: "boundary", pattern: /exactly\W+on a lower or upper|edge case rule/i },
  { id: "urgent_wording", pattern: /hit or pass/i },
];

function parseRules(file: string, lines: CleanLine[], out: ReferenceTables): void {
  for (const { text, line } of lines) {
    for (const { id, pattern } of RULE_PATTERNS) {
      if (pattern.test(text) && !out.rules.some((r) => r.id === id)) {
        out.rules.push({ id, text: stripMarkdown(text), source: { file, line } });
      }
    }
  }
}

function dedupeAliases(aliases: AliasRow[]): AliasRow[] {
  const seen = new Set<string>();
  const result: AliasRow[] = [];
  for (const a of aliases) {
    const key = normName(a.alias);
    if (!key || key === normName(a.canonical) || seen.has(key)) continue;
    seen.add(key);
    result.push(a);
  }
  return result;
}

export function isReportFile(name: string): boolean {
  return /^report[_-]/i.test(name);
}

export function buildReferenceTables(files: CorpusFile[]): ReferenceTables {
  const out: ReferenceTables = { aliases: [], urgent: [], ranges: [], rules: [] };
  const sorted = [...files].filter((f) => !isReportFile(f.name)).sort((a, b) => a.name.localeCompare(b.name));
  for (const f of sorted) {
    const lines = cleanLines(f.text);
    parseTables(f.name, lines, out);
    parseBullets(f.name, lines, out);
    parseRules(f.name, lines, out);
  }
  out.aliases = dedupeAliases(out.aliases);
  return out;
}

export type { AliasRow, RangeRow, UrgentRow };
