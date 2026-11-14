/**
 * LLM extraction fallback. Only used when the deterministic parser finds no
 * tests at all (an unusual layout). The model's output is validated with Zod
 * and then every value is checked against the report: a value that does not
 * literally appear in the cleaned text is thrown away, so the model cannot
 * invent a result.
 */
import { z } from "zod";
import { chatJSON, llmConfigured } from "./llm/groq";
import { parseValueUnit } from "./parser";
import type { ParsedTest } from "./types";

const Extraction = z.object({
  tests: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        value: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
        unit: z
          .union([z.string(), z.null()])
          .optional()
          .transform((u) => (u && u.trim() ? u.trim() : null)),
      }),
    )
    .max(60),
});

const SYSTEM = [
  "You extract lab test results from report text. You do not interpret them.",
  'Return JSON: { "tests": [ { "name": string, "value": string, "unit": string or null } ] }',
  "Rules: copy the name, value and unit exactly as written in the text. Do not convert, round or fix anything.",
  "Skip patient details, dates, ids and reference ranges. If there are no test results, return { \"tests\": [] }.",
].join("\n");

export interface ExtractionResult {
  tests: ParsedTest[];
  rejected: Array<{ name: string; value: string; reason: string }>;
  error: string | null;
}

/** Pure check, exported for tests: keeps only rows whose name and value literally appear in the text. */
export function verifyExtraction(rows: Array<{ name: string; value: string; unit: string | null }>, cleanedText: string): ExtractionResult {
  const haystack = cleanedText.toLowerCase();
  const lines = cleanedText.split("\n");
  const tests: ParsedTest[] = [];
  const rejected: ExtractionResult["rejected"] = [];
  for (const row of rows) {
    const value = row.value.trim();
    const valueSeen = new RegExp(`(?<![\\d.])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d])`, "i").test(cleanedText);
    if (!value || !valueSeen) {
      rejected.push({ name: row.name, value, reason: "value does not appear in the report text" });
      continue;
    }
    if (!haystack.includes(row.name.toLowerCase())) {
      rejected.push({ name: row.name, value, reason: "test name does not appear in the report text" });
      continue;
    }
    if (!parseValueUnit(value)) {
      rejected.push({ name: row.name, value, reason: "value is not a number or a known result word" });
      continue;
    }
    if (row.unit && !haystack.includes(row.unit.toLowerCase())) row.unit = null;
    const line = lines.findIndex((l) => l.toLowerCase().includes(row.name.toLowerCase())) + 1;
    tests.push({ name: row.name, value, unit: row.unit, layout: "llm-extraction (verified against the text)", line });
  }
  return { tests, rejected, error: null };
}

export async function extractWithLlm(cleanedText: string): Promise<ExtractionResult> {
  if (!llmConfigured()) return { tests: [], rejected: [], error: "LLM not configured" };
  const res = await chatJSON({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: cleanedText.slice(0, 6000) },
    ],
    maxTokens: 700,
    temperature: 0,
    deadlineMs: 12_000,
  });
  if (!res.ok) return { tests: [], rejected: [], error: res.error };
  const parsed = Extraction.safeParse(res.json);
  if (!parsed.success) return { tests: [], rejected: [], error: "extraction reply did not match the schema" };
  return verifyExtraction(parsed.data.tests, cleanedText);
}
