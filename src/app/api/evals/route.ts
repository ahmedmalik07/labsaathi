import { NextResponse } from "next/server";
import { runAllEvals } from "@/lib/evals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Runs the acceptance cases live against the deployed rules engine. No LLM involved. */
export async function GET() {
  return NextResponse.json({ ...runAllEvals(), ranAt: new Date().toISOString() });
}
