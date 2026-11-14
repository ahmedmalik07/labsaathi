/**
 * Follow-up chat, locked to the session's report.
 * Order of checks: privacy lock (code) -> LLM with engine facts only -> guard -> template.
 */
import { z } from "zod";
import { allowedNumbers, type EngineFacts } from "./facts";
import { checkText, withDisclaimer } from "./guard";
import { knownNames, reference, samples } from "./kb";
import { chatJSON, llmConfigured, type ChatMessage } from "./llm/groq";
import { checkPrivacy } from "./privacy";
import type { SessionData } from "./session";

type Lang = "en" | "roman-urdu";

export interface ChatReply {
  reply: string;
  refused: boolean;
  reason: string | null;
  source: "privacy-lock" | "llm" | "template";
  model: string | null;
  citation: { file: string; line: number } | null;
  guard: { passed: boolean; attempts: number; violations: string[] };
}

const LlmAnswer = z.object({ answer: z.string().min(2).max(1500) });

function systemPrompt(lang: Lang): string {
  return [
    "You are Samjho. You answer follow-up questions about ONE lab report.",
    "FACTS is the rules-engine output for that report. It is all you know about the patient.",
    "Rules:",
    "1. Use only numbers that appear in FACTS. Never write any other number.",
    "2. Never diagnose. Never write \"you have\" or say the patient has a disease. Say only a doctor can tell.",
    "3. Never change a status from FACTS and never invent a normal range.",
    "4. If the question is not about this report or its tests, say you can only help with this report.",
    "5. If asked about any other patient or report, refuse.",
    "6. Class 8 reading level. At most 110 words.",
    "7. If a result is urgent, remind the patient to see a doctor today.",
    'Return JSON: { "answer": "..." }',
    lang === "roman-urdu" ? "Language: Roman Urdu (Urdu in English letters). Keep test names, units and numbers as in FACTS." : "Language: simple English.",
  ].join("\n");
}

function templateAnswer(facts: EngineFacts, lang: Lang): string {
  const lines = facts.tests.map((t) => {
    const value = `${t.value}${t.unit ? " " + t.unit : ""}${t.converted ? ` (${t.converted})` : ""}`;
    const range = t.normalRange ? (lang === "en" ? `, normal range ${t.normalRange}` : `, normal range ${t.normalRange}`) : "";
    return `- ${t.test}: ${value}, ${t.status.replace("_", " ")}${range}`;
  });
  const head =
    lang === "en"
      ? "I could not reach the language model just now, so here are the facts from your report:"
      : "Is waqt language model se rabta nahi ho saka, is liye aap ki report ke haqaiq yeh hain:";
  const tail = facts.urgent ? (lang === "en" ? "\nOne result is urgent. See a doctor today." : "\nEk result urgent hai. Aaj hi doctor ko dikhayein.") : "";
  return `${head}\n${lines.join("\n")}${tail}`;
}

export async function answerChat(
  session: SessionData,
  message: string,
  lang: Lang = "en",
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<ChatReply> {
  const privacyRule = reference.rules.find((r) => r.id === "privacy");
  const verdict = checkPrivacy(
    message,
    { name: session.name, mrn: session.mrn },
    { known: samples.map((s) => ({ name: s.label, mrn: s.mrn, id: s.id })), testNames: knownNames, source: privacyRule?.source ?? null },
  );
  if (!verdict.allowed) {
    return {
      reply: verdict.refusal!,
      refused: true,
      reason: verdict.reason,
      source: "privacy-lock",
      model: null,
      citation: privacyRule?.source ?? null,
      guard: { passed: true, attempts: 0, violations: [] },
    };
  }

  const facts = session.facts;
  const fallback = (violations: string[], attempts: number): ChatReply => ({
    reply: withDisclaimer(templateAnswer(facts, lang), lang),
    refused: false,
    reason: null,
    source: "template",
    model: null,
    citation: null,
    guard: { passed: violations.length === 0, attempts, violations },
  });
  if (!llmConfigured()) return fallback([], 0);

  const allowed = allowedNumbers(facts);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(lang) },
    { role: "user", content: `FACTS:\n${JSON.stringify(facts)}` },
    ...history.slice(-6).map((h) => ({ role: h.role, content: h.content.slice(0, 600) })),
    { role: "user", content: `QUESTION: ${message}` },
  ];

  let violations: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await chatJSON({ messages, maxTokens: 500, cache: attempt === 0, deadlineMs: attempt === 0 ? 16_000 : 10_000 });
    if (!res.ok) return fallback(violations, attempt);
    const parsed = LlmAnswer.safeParse(res.json);
    if (parsed.success) {
      const check = checkText(parsed.data.answer, allowed);
      if (check.ok) {
        return {
          reply: withDisclaimer(parsed.data.answer.trim(), lang),
          refused: false,
          reason: null,
          source: "llm",
          model: res.model,
          citation: null,
          guard: { passed: true, attempts: attempt + 1, violations: [] },
        };
      }
      violations = check.violations;
    } else {
      violations = ["reply did not match the schema"];
    }
    messages.push(
      { role: "assistant", content: JSON.stringify(res.json).slice(0, 1500) },
      { role: "user", content: `Rejected by the safety check: ${violations.slice(0, 6).join("; ")}. Answer again as JSON. Use only numbers from FACTS and do not diagnose.` },
    );
  }
  return fallback(violations, 2);
}
