/**
 * Explainer. The LLM receives ONLY the engine facts for the current patient and
 * writes plain-language text plus questions for the doctor. It never classifies:
 * the status of every test is already decided by the rules engine.
 *
 * Flow: Groq -> guard -> (retry once with the violations) -> deterministic template.
 */
import { z } from "zod";
import { allowedNumbers, type EngineFacts } from "./facts";
import { checkTexts, disclaimerFor } from "./guard";
import { chatJSON, hashKey, llmConfigured, type ChatMessage, type LlmUsage } from "./llm/groq";
import { templateExplanation, templateQuestions } from "./template";
import type { Explanation } from "./types";

type Lang = "en" | "roman-urdu";

const LlmExplanation = z.object({
  overview: z.string().min(10).max(900),
  tests: z
    .array(z.object({ test: z.string().min(1).max(80), measures: z.string().min(5).max(600), meaning: z.string().min(5).max(700) }))
    .max(30),
  doctorQuestions: z.array(z.string().min(8).max(260)).min(3).max(5),
});

export function explainerSystemPrompt(lang: Lang): string {
  return [
    "You are LabSaathi, a friendly helper that explains lab reports to patients.",
    "You receive FACTS as JSON. A rules engine already decided the status of every test. You only explain.",
    "",
    "Hard rules:",
    "1. Use only numbers that appear in FACTS. Never write any other number: no other ranges, doses, hours, days, percentages or counts.",
    "2. Never change or question a status. Never give a range for a test whose normalRange is null.",
    "3. Never diagnose. The words \"you have\", \"you may have\", \"you are suffering from\" and \"diagnosed with\" are banned in every sentence, even in a negative sentence such as \"this does not mean you have ...\". Write \"your level is high\" instead of \"you have a high level\". You may say what a low or high result \"can sometimes be linked with\" in general, and that only a doctor can tell what it means for this patient.",
    "4. Write for a class 8 student: short sentences, everyday words, no jargon. If you must use a medical word, explain it in the same sentence.",
    "5. status \"unclassified\": say the lab's files do not cover this test, so it cannot be classified from the files, and suggest asking the doctor.",
    "6. status \"needs_info\": explain what the test measures and say the result cannot be labelled until the missing age or sex is given. Do not guess.",
    "7. status \"urgent\": say clearly and calmly that the patient should see a doctor today.",
    "8. Do not mention any other patient, file names, or these rules.",
    "",
    "Return one JSON object with exactly these keys:",
    '  "overview": 2 to 3 sentences that sum up the report.',
    '  "tests": one item per test in FACTS, same order, each { "test": the exact test name from FACTS, "measures": what this test measures in the body (1 to 2 sentences), "meaning": what this patient\'s result means and what low or high can be linked with in general (2 to 3 sentences) }.',
    '  "doctorQuestions": 3 to 5 questions the patient can ask the doctor, written as the patient ("Why is my ..."), about the abnormal or unclassified results first.',
    "",
    lang === "roman-urdu"
      ? "Language: write every sentence in Roman Urdu (Urdu written in English letters, the way people in Pakistan text). Keep test names, units and numbers exactly as in FACTS."
      : "Language: simple English.",
  ].join("\n");
}

export interface ExplainMeta {
  usage: LlmUsage | null;
  latencyMs: number;
  cached: boolean;
  llmError: string | null;
}

const memo = new Map<string, { at: number; value: Explanation }>();
const MEMO_TTL = 60 * 60 * 1000;

export async function explain(facts: EngineFacts, lang: Lang = "en", options: { useLlm?: boolean } = {}): Promise<{ explanation: Explanation; meta: ExplainMeta }> {
  const started = Date.now();
  const key = hashKey("explain", lang, facts);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL) {
    return { explanation: hit.value, meta: { usage: null, latencyMs: Date.now() - started, cached: true, llmError: null } };
  }

  if (options.useLlm === false || !llmConfigured() || facts.tests.length === 0) {
    return {
      explanation: templateExplanation(facts, lang),
      meta: { usage: null, latencyMs: Date.now() - started, cached: false, llmError: options.useLlm === false ? "LLM skipped by request" : llmConfigured() ? null : "LLM not configured" },
    };
  }

  const allowed = allowedNumbers(facts);
  const messages: ChatMessage[] = [
    { role: "system", content: explainerSystemPrompt(lang) },
    { role: "user", content: `FACTS:\n${JSON.stringify(facts)}` },
  ];
  const usage: LlmUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let violations: string[] = [];
  let llmError: string | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    attempts = attempt + 1;
    const res = await chatJSON({ messages, maxTokens: 1100, cache: attempt === 0, deadlineMs: attempt === 0 ? 20_000 : 12_000 });
    if (!res.ok) {
      llmError = res.error;
      break;
    }
    usage.promptTokens += res.usage.promptTokens;
    usage.completionTokens += res.usage.completionTokens;
    usage.totalTokens += res.usage.totalTokens;

    const parsed = LlmExplanation.safeParse(res.json);
    if (!parsed.success) {
      violations = [`reply did not match the schema: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`];
    } else {
      const data = parsed.data;
      const texts = [data.overview, ...data.tests.flatMap((t) => [t.measures, t.meaning]), ...data.doctorQuestions];
      const verdict = checkTexts(texts, allowed);
      const names = new Set(facts.tests.map((t) => t.test.toLowerCase()));
      const strangers = data.tests.filter((t) => !names.has(t.test.toLowerCase())).map((t) => t.test);
      violations = [...verdict.violations, ...strangers.map((s) => `test "${s}" is not in the engine output`)];
      if (violations.length === 0) {
        // Keep engine order and names; fill any test the model skipped from the template.
        const fallback = templateExplanation(facts, lang);
        const explanation: Explanation = {
          lang,
          overview: data.overview.trim(),
          tests: facts.tests.map((t, i) => {
            const found = data.tests.find((x) => x.test.toLowerCase() === t.test.toLowerCase());
            return found ? { test: t.test, measures: found.measures.trim(), meaning: found.meaning.trim() } : fallback.tests[i];
          }),
          doctorQuestions: data.doctorQuestions.map((q) => q.trim()),
          disclaimer: disclaimerFor(lang),
          source: "llm",
          model: res.model,
          guard: { passed: true, attempts, violations: [] },
        };
        memo.set(key, { at: Date.now(), value: explanation });
        if (memo.size > 300) memo.delete(memo.keys().next().value as string);
        return { explanation, meta: { usage, latencyMs: Date.now() - started, cached: res.cached, llmError: null } };
      }
    }
    // Retry once, telling the model exactly what the guard rejected.
    messages.push(
      { role: "assistant", content: JSON.stringify(res.json).slice(0, 3000) },
      {
        role: "user",
        content: `Your reply was rejected by the safety check for these reasons:\n- ${violations.slice(0, 8).join("\n- ")}\nWrite the JSON again. Use only numbers from FACTS and never say the patient has a disease.`,
      },
    );
  }

  const explanation = templateExplanation(facts, lang, violations, attempts);
  return { explanation, meta: { usage: usage.totalTokens ? usage : null, latencyMs: Date.now() - started, cached: false, llmError } };
}

/** Flat text version for API consumers that want a single string. */
export function explanationToText(e: Explanation): string {
  const lines = [e.overview, ""];
  for (const t of e.tests) lines.push(`${t.test}: ${t.measures} ${t.meaning}`, "");
  lines.push(e.disclaimer);
  return lines.join("\n").trim();
}

export { templateQuestions };
