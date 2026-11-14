/**
 * Guard. Checks LLM text BEFORE it is shown.
 *   1. No number that is not in the engine output.
 *   2. No diagnosis phrasing ("you have", "you are suffering from", disease verdicts).
 *   3. The "only a licensed doctor can diagnose" line is always attached (added in code).
 * A failure triggers one retry, then the deterministic template is used instead.
 */
import { config } from "./config";

const DISEASES =
  "diabetes|diabetic|pre-?diabetes|anemia|anaemia|anemic|anaemic|hepatitis|cirrhosis|jaundice|leukemia|leukaemia|cancer|tumou?r|hypothyroidism|hyperthyroidism|thyroid disease|infection|sepsis|kidney disease|liver disease|fatty liver|thrombocytopenia|heart disease|high cholesterol disease";

const DIAGNOSIS_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: '"you have"', pattern: /\byou\s+(?:\w+\s+){0,2}?(?:have|'ve got|have got)\b(?!\s+(?:to|this|it|them|your|a\s+doctor|any\s+questions?|questions?|more\s+questions?)\b)/i },
  { label: '"you\'ve"', pattern: /\byou['’]ve\b/i },
  { label: '"you are suffering from"', pattern: /\byou\s+(?:are|were|may be|might be|could be)\s+suffering\b|\byou\s+suffer\s+from\b|\bsuffering\s+from\b/i },
  { label: "disease verdict", pattern: new RegExp(String.raw`\b(?:you|the patient|he|she|they)\s+(?:is|are|has|have|got)\s+(?:\w+\s+){0,3}?(?:${DISEASES})\b`, "i") },
  { label: "disease verdict", pattern: new RegExp(String.raw`\b(?:this|it|that|which|result|value|level)\s+(?:is|means|indicates|shows|confirms|proves|suggests)\s+(?:that\s+)?(?:you\s+|a\s+|an\s+)?(?:\w+\s+){0,2}?(?:${DISEASES})\b`, "i") },
  { label: '"diagnosed with"', pattern: /\bdiagnosed\s+with\b|\byour\s+diagnosis\b|\bthe\s+diagnosis\s+is\b/i },
  { label: "certainty", pattern: /\b(?:this|it)\s+(?:confirms|proves)\b|\byou\s+definitely\b|\bwithout\s+a?\s*doubt\b/i },
  // Roman Urdu
  { label: "Roman Urdu verdict", pattern: new RegExp(String.raw`\baap\s?k[oa]\s+(?:\w+\s+){0,3}?(?:${DISEASES}|sugar ki bimari|khoon ki kami|jigar ki bimari|bimari|marz)\s+(?:\w+\s+){0,2}?(?:hai|hain|ho gaya|ho gayi|ho chuk[ai]|lahaq)\b`, "i") },
  { label: "Roman Urdu verdict", pattern: new RegExp(String.raw`\baap\s+(?:${DISEASES}|sugar|khoon ki kami)\s+k[ei]\s+(?:mareez|mariz|shikar)\b`, "i") },
  { label: "Roman Urdu verdict", pattern: /\baap\s+(?:\w+\s+){0,2}?(?:mubtala|shikar)\b/i },
];

export interface GuardResult {
  ok: boolean;
  violations: string[];
}

/** Numbers glued to letters (B12, T3, HbA1c) are names, not values. List markers are not values either. */
function extractNumbers(text: string): number[] {
  const withoutMarkers = text.replace(/^\s*\d{1,2}[.)]\s+/gm, "");
  const out: number[] = [];
  for (const m of withoutMarkers.matchAll(/(?<![A-Za-z\d.,^])\d[\d,]*(?:\.\d+)?(?![A-Za-z\d])/g)) {
    const n = Number(m[0].replace(/,/g, "").replace(/\.$/, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function checkText(text: string, allowed: number[]): GuardResult {
  const violations: string[] = [];
  const allowedSet = new Set(allowed.map((n) => String(Number(n))));
  for (const n of extractNumbers(text)) {
    if (!allowedSet.has(String(n))) violations.push(`number ${n} is not in the engine output`);
  }
  for (const { label, pattern } of DIAGNOSIS_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      // Quote the whole sentence so the retry prompt can tell the model exactly what to rewrite.
      const start = Math.max(text.lastIndexOf(".", m.index ?? 0), text.lastIndexOf("\n", m.index ?? 0)) + 1;
      const endDot = text.indexOf(".", (m.index ?? 0) + m[0].length);
      const sentence = text.slice(start, endDot === -1 ? text.length : endDot + 1).trim().slice(0, 200);
      violations.push(`diagnosis phrasing (${label}) in: "${sentence}"`);
    }
  }
  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}

export function checkTexts(texts: string[], allowed: number[]): GuardResult {
  const violations = texts.flatMap((t) => checkText(t, allowed).violations);
  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}

export function disclaimerFor(lang: "en" | "roman-urdu"): string {
  return lang === "roman-urdu" ? config.phrases.disclaimerRomanUrdu : config.phrases.disclaimer;
}

/** Guarantees the doctor line is on every reply, whatever the model wrote. */
export function withDisclaimer(text: string, lang: "en" | "roman-urdu"): string {
  const line = disclaimerFor(lang);
  const has = /only a licensed (?:medical )?doctor can diagnose/i.test(text) || /licensed doctor hi/i.test(text);
  return has ? text : `${text.trim()}\n\n${line}`;
}
