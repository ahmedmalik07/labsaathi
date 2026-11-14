import { NextResponse } from "next/server";
import { errorJson, rateLimit } from "@/lib/api";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Speech to text for voice questions, through Groq's free Whisper model.
 *
 * We call the *translations* endpoint: whatever the patient speaks (Urdu,
 * Punjabi, English or a mix) comes back as English text. That is deliberate.
 * The privacy lock and the guard check text in Latin script, so an English
 * transcript goes through exactly the same checks as a typed question. The
 * reply is still written in the language the patient picked.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SECONDS_HINT = 60;

export async function POST(req: Request) {
  const limited = rateLimit(req, "transcribe", config.api.chatPerMinute);
  if (limited) return limited;
  if (!config.llm.apiKey) return errorJson(503, "speech_unavailable", "Voice questions need the language service, which is not configured. Please type your question.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorJson(400, "invalid_form", "Send the recording as multipart form data with a field named 'audio'.");
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return errorJson(400, "no_audio", "No recording was received.");
  if (audio.size > MAX_BYTES) return errorJson(413, "audio_too_large", `Recordings must be shorter than about ${MAX_SECONDS_HINT} seconds.`);

  const upstream = new FormData();
  upstream.append("file", audio, (audio as File).name || "question.webm");
  upstream.append("model", "whisper-large-v3");
  upstream.append("response_format", "json");
  upstream.append("temperature", "0");

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${config.llm.baseUrl}/audio/translations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.llm.apiKey}` },
        body: upstream,
        signal: controller.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as { text?: string };
        const text = (json.text ?? "").trim();
        // Whisper invents a word or two for silence ("you", "Thank you."). Treat very short output as nothing heard.
        if (text.replace(/[^a-z]/gi, "").length < 4) return errorJson(422, "nothing_heard", "I could not hear a question. Tap the mic and speak a little closer.");
        return NextResponse.json({ text: text.slice(0, config.api.maxChatChars) });
      }
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      return errorJson(502, "speech_failed", "The voice service could not read that recording. Please type your question.");
    } catch {
      if (attempt === 0) continue;
      return errorJson(504, "speech_timeout", "The voice service took too long. Please type your question.");
    } finally {
      clearTimeout(timer);
    }
  }
  return errorJson(502, "speech_failed", "The voice service could not read that recording. Please type your question.");
}
