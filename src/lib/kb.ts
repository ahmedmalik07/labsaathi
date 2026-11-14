/**
 * Server-side access to the generated knowledge base (src/generated/kb.json).
 * Never import this from a client component: it contains the raw sample reports.
 */
import raw from "@/generated/kb.json";
import { knownTestNames } from "./engine";
import type { ReferenceTables } from "./types";

export interface SampleReport {
  id: string;
  file: string;
  label: string;
  tests: string[];
  mrn: string | null;
  raw: string;
}

interface KnowledgeBase {
  generatedAt: string;
  corpus: { files: string[]; rawChars: number; cleanChars: number; removedPct: number };
  reference: ReferenceTables;
  samples: SampleReport[];
}

export const kb = raw as unknown as KnowledgeBase;
export const reference: ReferenceTables = kb.reference;
export const knownNames: string[] = knownTestNames(reference);
export const samples: SampleReport[] = kb.samples;

export function ruleSource(id: ReferenceTables["rules"][number]["id"]) {
  return reference.rules.find((r) => r.id === id) ?? null;
}
