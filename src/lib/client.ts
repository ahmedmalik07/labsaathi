/** Browser-side helpers shared by the tools. */
import type { AnalyzeResponse } from "./pipeline";
import type { TestResult } from "./types";

/** Runs a report through the same rules engine as the main app. explain:false skips the AI, so it is fast and free. */
export async function analyzeText(reportText: string, extra: { age?: string; sex?: string; explain?: boolean } = {}): Promise<AnalyzeResponse> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportText, age: extra.age || undefined, sex: extra.sex || undefined, explain: extra.explain ?? false }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "That report could not be read.");
  return json as AnalyzeResponse;
}

export const STATUS_WORD: Record<TestResult["status"], string> = {
  normal: "Normal",
  low: "Low",
  high: "High",
  abnormal: "Abnormal",
  urgent: "Urgent",
  needs_info: "Needs info",
  unclassified: "Cannot classify",
};

/** A short plain-text summary of one analysis, used by share, QR and copy. */
export function summaryText(data: AnalyzeResponse, maxChars = 900): string {
  const first = data.patient.name?.split(" ")[0];
  const lines = [
    `Lab report summary${first ? ` for ${first}` : ""} (Samjho)`,
    ...(data.urgent ? ["URGENT: see a doctor today."] : []),
    ...data.results.map((r) => {
      const conv = r.conversion ? ` (= ${r.conversion.toValue} ${r.conversion.toUnit})` : "";
      const range = r.rangeUsed && r.rangeUsed.low !== null && r.rangeUsed.high !== null ? `, lab range ${r.rangeUsed.low}-${r.rangeUsed.high}` : "";
      return `- ${r.canonicalName}: ${r.rawValue}${r.unit ? " " + r.unit : ""}${conv} = ${STATUS_WORD[r.status]}${range}`;
    }),
    "Only a licensed doctor can diagnose.",
  ];
  const text = lines.join("\n");
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
}

export function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
