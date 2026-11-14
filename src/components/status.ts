import type { Status } from "@/lib/types";

export interface StatusMeta {
  label: string;
  /** Hex colour used by the 3D tube and inline styles. */
  color: string;
  /** Tailwind classes for the pill. Text colours are chosen for contrast on the navy panels. */
  pill: string;
  ring: string;
  hint: string;
}

export const STATUS: Record<Status, StatusMeta> = {
  normal: { label: "Normal", color: "#34d399", pill: "bg-emerald-400/15 text-emerald-200 border-emerald-300/40", ring: "border-emerald-300/25", hint: "Inside the lab's normal range" },
  low: { label: "Low", color: "#fbbf24", pill: "bg-amber-400/15 text-amber-100 border-amber-300/45", ring: "border-amber-300/30", hint: "Below the lab's normal range" },
  high: { label: "High", color: "#fbbf24", pill: "bg-amber-400/15 text-amber-100 border-amber-300/45", ring: "border-amber-300/30", hint: "Above the lab's normal range" },
  abnormal: { label: "Abnormal", color: "#fbbf24", pill: "bg-amber-400/15 text-amber-100 border-amber-300/45", ring: "border-amber-300/30", hint: "Not the expected result" },
  urgent: { label: "Urgent", color: "#f87171", pill: "bg-red-500/20 text-red-100 border-red-300/60", ring: "border-red-400/60", hint: "Reached the lab's urgent limit" },
  needs_info: { label: "Needs info", color: "#a78bfa", pill: "bg-violet-400/15 text-violet-100 border-violet-300/45", ring: "border-violet-300/35", hint: "Age or sex is needed to pick a range" },
  unclassified: { label: "Cannot classify", color: "#94a3b8", pill: "bg-slate-400/15 text-slate-100 border-slate-300/40", ring: "border-slate-300/20", hint: "Cannot be classified from the files" },
};

export const STEP_LABEL: Record<string, string> = {
  parse: "Read from report",
  alias: "Name match",
  context: "Matched by context",
  unit: "Unit check",
  conversion: "Unit conversion",
  urgent: "Urgent check",
  range: "Range chosen",
  demographics: "Age and sex",
  classify: "Result",
  note: "Note",
};
