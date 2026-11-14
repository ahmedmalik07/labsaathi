import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, rateLimit, readBody, zodError } from "@/lib/api";
import { config } from "@/lib/config";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Accepts a few common spellings so an automated client is not rejected over a key name. */
function normalise(body: unknown): unknown {
  if (typeof body === "string") return { reportText: body };
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const b = body as Record<string, unknown>;
  return {
    reportText: b.reportText ?? b.report_text ?? b.report ?? b.text ?? b.content ?? b.markdown ?? b.input,
    age: b.age ?? b.patientAge ?? b.patient_age,
    sex: b.sex ?? b.gender ?? b.patientSex ?? b.patient_sex,
    fileName: b.fileName ?? b.file_name ?? b.filename ?? b.title,
    lang: b.lang ?? b.language,
    explain: b.explain,
  };
}

const Body = z.object({
  reportText: z
    .string({ message: "reportText is required: send the lab report as text." })
    .trim()
    .min(1, "reportText is empty.")
    .max(config.api.maxReportChars, `reportText is longer than ${config.api.maxReportChars} characters.`),
  age: z.union([z.number(), z.string().max(20)]).nullish(),
  sex: z.string().max(20).nullish(),
  fileName: z.string().max(200).nullish(),
  lang: z.enum(["en", "roman-urdu"]).nullish(),
  explain: z.boolean().nullish(),
});

/** A GET explains how to call the endpoint instead of returning a bare 405. */
export async function GET() {
  return NextResponse.json(
    {
      endpoint: "POST /api/analyze",
      contentType: "application/json (a text/plain or text/markdown body is also accepted as the report itself)",
      request: {
        reportText: "string, required: the lab report as text",
        age: "number or string, optional: used only when the report does not give an age",
        sex: '"male" | "female", optional: used only when the report does not give a sex',
        lang: '"en" | "roman-urdu", optional, default "en"',
        explain: "boolean, optional, default true. false skips the language model and returns the template explanation",
      },
      response: {
        patient: "{ name, age, sex, mrn, missing[] }",
        results: "[{ canonicalName, originalName, value, unit, convertedValue, rangeUsed, status, direction, urgent, question, summary, trace[] }]",
        status: "normal | low | high | abnormal | urgent | needs_info | unclassified",
        urgent: "boolean",
        needsInfo: "[{ field, question, blocking[] }]",
        explanation: "string: engine verdict lines, plain-language text, doctor questions, doctor disclaimer",
        doctorQuestions: "string[]",
        trace: "[{ step, detail, source? }]",
        sessionId: "signed token for POST /api/chat",
      },
    },
    { headers: CORS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "analyze", config.api.analyzePerMinute);
  if (limited) return limited;

  const read = await readBody(req);
  if (!read.ok) return read.response;

  const parsed = Body.safeParse(normalise(read.body));
  if (!parsed.success) return zodError(parsed.error);

  try {
    const { reportText, age, sex, fileName, lang, explain } = parsed.data;
    const out = await runPipeline({ reportText, age, sex, fileName }, { lang: lang ?? "en", explain: explain ?? true });
    return NextResponse.json(out, { headers: CORS });
  } catch (err) {
    console.error("[analyze] failed", err);
    return errorJson(500, "analysis_failed", "The report could not be analysed. Nothing was guessed.");
  }
}
