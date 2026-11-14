import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, rateLimit, readBody, zodError } from "@/lib/api";
import { answerChat } from "@/lib/chat";
import { config } from "@/lib/config";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  sessionId: z.string({ message: "sessionId is required. Call /api/analyze first." }).min(10).max(20_000),
  message: z
    .string({ message: "message is required." })
    .trim()
    .min(1, "message is empty.")
    .max(config.api.maxChatChars, `message is longer than ${config.api.maxChatChars} characters.`),
  lang: z.enum(["en", "roman-urdu"]).nullish(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(12)
    .nullish(),
});

export async function POST(req: Request) {
  const limited = rateLimit(req, "chat", config.api.chatPerMinute);
  if (limited) return limited;

  const read = await readBody(req);
  if (!read.ok) return read.response;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return zodError(parsed.error);

  const session = readSession(parsed.data.sessionId);
  if (!session) {
    return errorJson(401, "invalid_session", "This session is not valid or has expired. Analyse the report again to start a new one.");
  }

  try {
    const reply = await answerChat(session, parsed.data.message, parsed.data.lang ?? "en", parsed.data.history ?? []);
    return NextResponse.json(reply);
  } catch (err) {
    console.error("[chat] failed", err);
    return errorJson(500, "chat_failed", "The follow-up could not be answered. Please try again.");
  }
}
