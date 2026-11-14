import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, rateLimit, readBody, zodError } from "@/lib/api";
import { config } from "@/lib/config";
import { explain, explanationToText } from "@/lib/explain";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  sessionId: z.string({ message: "sessionId is required. Call /api/analyze first." }).min(10).max(20_000),
  lang: z.enum(["en", "roman-urdu"]),
});

/** Re-explains the session's report in another language. Same facts, same guard, same fallback. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "explain", config.api.chatPerMinute);
  if (limited) return limited;

  const read = await readBody(req);
  if (!read.ok) return read.response;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return zodError(parsed.error);

  const session = readSession(parsed.data.sessionId);
  if (!session) return errorJson(401, "invalid_session", "This session is not valid or has expired. Analyse the report again.");

  try {
    const { explanation, meta } = await explain(session.facts, parsed.data.lang);
    return NextResponse.json({
      explanation: explanationToText(explanation),
      explanationDetail: explanation,
      doctorQuestions: explanation.doctorQuestions,
      meta: { cached: meta.cached, llmMs: meta.latencyMs, tokens: meta.usage, llmError: meta.llmError },
    });
  } catch (err) {
    console.error("[explain] failed", err);
    return errorJson(500, "explain_failed", "The explanation could not be written. Please try again.");
  }
}
