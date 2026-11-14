import type { Status } from "@/lib/types";

export interface StatusMeta {
  label: string;
  /** Hex colour used by the 3D tube and inline styles. */
  color: string;
  /** Tailwind classes for the pill. */
  pill: string;
  ring: string;
  hint: string;
}

export const STATUS: Record<Status, StatusMeta> = {
  normal: { label: "Normal", color: "#0b7a68", pill: "bg-forest text-white border-forest", ring: "border-ink/15", hint: "Inside the lab's normal range" },
  low: { label: "Low", color: "#f59e0b", pill: "bg-sun text-ink border-sun", ring: "border-ink/15", hint: "Below the lab's normal range" },
  high: { label: "High", color: "#f59e0b", pill: "bg-sun text-ink border-sun", ring: "border-ink/15", hint: "Above the lab's normal range" },
  abnormal: { label: "Abnormal", color: "#f59e0b", pill: "bg-sun text-ink border-sun", ring: "border-ink/15", hint: "Not the expected result" },
  urgent: { label: "Urgent", color: "#c81e1e", pill: "bg-urgent text-white border-urgent", ring: "border-urgent", hint: "Reached the lab's urgent limit" },
  needs_info: { label: "Needs info", color: "#3b5bdb", pill: "bg-info text-white border-info", ring: "border-info/50", hint: "Age or sex is needed to pick a range" },
  unclassified: { label: "Cannot classify", color: "#8a8079", pill: "bg-white text-ink border-ink/40", ring: "border-ink/15", hint: "Cannot be classified from the files" },
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
