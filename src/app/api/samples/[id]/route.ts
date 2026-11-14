import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { samples } from "@/lib/kb";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sample = samples.find((s) => s.id.toLowerCase() === id.toLowerCase());
  if (!sample) return errorJson(404, "sample_not_found", `There is no sample report with id "${id}".`);
  return NextResponse.json({ id: sample.id, file: sample.file, label: sample.label, reportText: sample.raw });
}
