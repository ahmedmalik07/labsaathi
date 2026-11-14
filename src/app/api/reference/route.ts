import { NextResponse } from "next/server";
import { reference } from "@/lib/kb";

export const runtime = "nodejs";

/**
 * The lab's reference tables exactly as parsed from lab_reports/ at build time:
 * aliases, ranges, urgent limits and cited rules, each with its file and line.
 * No patient data. Used by the Tools page.
 */
export async function GET() {
  return NextResponse.json(reference, { headers: { "Cache-Control": "public, max-age=300" } });
}
