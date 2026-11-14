/** Small text helpers shared by the reference loader, the parser and the engine. */

export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase, punctuation-free key used to compare test names. */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

export function parseNumber(s: string): number | null {
  const t = s.trim().replace(/(?<=\d),(?=\d{3}\b)/g, "");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Avoids 6.0 * 18 = 108.00000000000001 style noise. */
export function round(n: number, places = 6): number {
  const f = 10 ** places;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function formatNumber(n: number): string {
  return String(round(n, 4));
}

export function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

export function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => stripMarkdown(c));
}

export function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

export function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
