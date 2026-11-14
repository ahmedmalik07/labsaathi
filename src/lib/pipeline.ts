/**
 * Full request pipeline for POST /api/analyze:
 * clean -> parse (-> LLM extraction only if nothing was found) -> rules engine
 * -> engine facts -> explainer (LLM + guard, or template) -> signed session.
 */
import { analyzeParsed, type AnalyzeInput } from "./analyze";
import { config } from "./config";
import { explain, explanationToText } from "./explain";
import { extractWithLlm } from "./extract";
import { buildFacts } from "./facts";
import { knownNames, reference } from "./kb";
import { configuredModels } from "./llm/groq";
import { parseReport } from "./parser";
import { createSession } from "./session";
import type { Explanation, NeedsInfo, Patient, TestResult, TraceStep } from "./types";

export interface AnalyzeResponse {
  patient: Patient;
  results: TestResult[];
  urgent: boolean;
  urgentMessage: string | null;
  needsInfo: NeedsInfo[];
  /** Plain text explanation, always ends with the doctor disclaimer. */
  explanation: string;
  explanationDetail: Explanation;
  doctorQuestions: string[];
  trace: TraceStep[];
  sessionId: string;
  disclaimer: string;
  meta: {
    extraction: "deterministic" | "llm" | "none";
    strictNames: boolean;
    explanationSource: "llm" | "template";
    model: string | null;
    configuredModels: string[];
    cached: boolean;
    tokens: { prompt: number; completion: number; total: number } | null;
    timingsMs: { engine: number; llm: number; total: number };
    cleaning: { rawChars: number; cleanChars: number; removedPct: number };
    llmError: string | null;
  };
}

export interface PipelineOptions {
  lang?: "en" | "roman-urdu";
  /** false = skip the LLM and return the template explanation (fast path for bulk runs). */
  explain?: boolean;
}

export async function runPipeline(input: AnalyzeInput, options: PipelineOptions = {}): Promise<AnalyzeResponse> {
  const started = performance.now();
  const lang = options.lang ?? "en";

  const parsed = parseReport(input.reportText, { knownNames });
  const extra: TraceStep[] = [];
  let tests = parsed.tests;

  if (tests.length === 0 && parsed.cleanedText.length > 0) {
    const extraction = await extractWithLlm(parsed.cleanedText);
    if (extraction.tests.length > 0) {
      tests = extraction.tests;
      parsed.extraction = "llm";
      extra.push({
        step: "parse",
        detail: `The rule-based parser found no tests, so the language model extracted ${extraction.tests.length}. Each value was checked and appears word for word in the report.`,
      });
    }
    for (const r of extraction.rejected) {
      extra.push({ step: "note", detail: `Rejected an extracted row ("${r.name}" = "${r.value}"): ${r.reason}.` });
    }
    if (extraction.tests.length === 0) {
      extra.push({
        step: "note",
        detail: `No test results could be read from this text${extraction.error ? ` (extraction fallback: ${extraction.error})` : ""}. Scanned or handwritten reports are not supported.`,
      });
    }
  }

  const analysis = analyzeParsed(parsed, input, reference, {}, tests);
  const engineMs = performance.now() - started;

  const facts = buildFacts(analysis);
  const { explanation, meta } = await explain(facts, lang, { useLlm: options.explain !== false });
  const sessionId = createSession({ name: analysis.patient.name, mrn: analysis.patient.mrn, facts });
  const totalMs = performance.now() - started;

  return {
    patient: analysis.patient,
    results: analysis.results,
    urgent: analysis.urgent,
    urgentMessage: analysis.urgentMessage,
    needsInfo: analysis.needsInfo,
    explanation: explanationToText(explanation, analysis),
    explanationDetail: explanation,
    doctorQuestions: explanation.doctorQuestions,
    trace: [...analysis.trace, ...extra],
    sessionId,
    disclaimer: explanation.disclaimer,
    meta: {
      extraction: parsed.extraction,
      strictNames: config.strictNames,
      explanationSource: explanation.source,
      model: explanation.model,
      configuredModels: configuredModels(),
      cached: meta.cached,
      tokens: meta.usage ? { prompt: meta.usage.promptTokens, completion: meta.usage.completionTokens, total: meta.usage.totalTokens } : null,
      timingsMs: { engine: Math.round(engineMs * 10) / 10, llm: meta.latencyMs, total: Math.round(totalMs) },
      cleaning: analysis.cleaning,
      llmError: meta.llmError,
    },
  };
}
