import { NextResponse } from "next/server";
import { samples } from "@/lib/kb";

export const runtime = "nodejs";

/** Quick-pick list for the UI. The report text itself is fetched one at a time. */
export async function GET() {
  return NextResponse.json({
    samples: samples.map((s) => ({ id: s.id, file: s.file, label: s.label, tests: s.tests })),
  });
}
