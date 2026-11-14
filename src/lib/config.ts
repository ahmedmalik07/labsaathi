/**
 * Single place for every tunable decision.
 * Nothing in here is a reference range: ranges, aliases and urgent thresholds
 * are parsed from lab_reports/ at build time (see scripts/build-kb.ts).
 */

function flag(name: string, fallback: boolean): boolean {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export interface UnitConversionRule {
  /** Canonical test names this applies to, or "any" for pure metric scaling. */
  tests: string[] | "any";
  from: string;
  to: string;
  factor: number;
  basis: string;
}

export const config = {
  /**
   * STRICT NAME MODE (one switch).
   * false (default): a name such as "pH Level" or "Protein" may be matched to
   *   "Urine pH" / "Urine Protein" when the report context says urine. The trace
   *   then shows "matched by context".
   * true: only exact names and glossary aliases are accepted. Everything else is
   *   "cannot be classified from the files".
   * Override with LABSAATHI_STRICT_NAMES=1.
   */
  get strictNames(): boolean {
    return flag("LABSAATHI_STRICT_NAMES", false);
  },

  /** Words that carry no meaning in a test name ("pH Level" -> "pH"). */
  nameFillerWords: ["level", "levels", "value", "values", "test", "result", "reading"],

  /**
   * Words that name a specimen. A name that already carries one of these
   * ("Serum Protein") is never context-matched to a different specimen family.
   */
  specimenWords: ["serum", "blood", "plasma", "urine", "urinary", "csf", "stool", "saliva", "sputum"],

  /**
   * Unit conversions. The factor for glucose is NOT in the files (documented in
   * README "Known failure cases"); the organiser README names mmol/L as a unit
   * the bot must handle, and 18 is the factor given in the brief.
   * The "any" rows are pure metric rescaling, no medical knowledge involved.
   */
  conversions: [
    {
      tests: ["Fasting Blood Sugar"],
      from: "mmol/l",
      to: "mg/dl",
      factor: 18,
      basis: "glucose: mg/dL = mmol/L x 18 (factor from the hackathon brief, not from the files)",
    },
    { tests: "any", from: "g/l", to: "g/dl", factor: 0.1, basis: "metric scaling: 1 dL = 0.1 L" },
    { tests: "any", from: "mg/l", to: "mg/dl", factor: 0.1, basis: "metric scaling: 1 dL = 0.1 L" },
    { tests: "any", from: "10^3/mcl", to: "cells/mcl", factor: 1000, basis: "metric scaling: thousands per mcL" },
    { tests: "any", from: "10^9/l", to: "cells/mcl", factor: 1000, basis: "metric scaling: 10^9 per L = 10^3 per mcL" },
    { tests: "any", from: "mciu/ml", to: "miu/l", factor: 1, basis: "metric scaling: micro per mL = milli per L" },
  ] as UnitConversionRule[],

  /** Spelling variants of the same unit. No arithmetic involved. */
  unitSynonyms: {
    "cells/ul": "cells/mcl",
    "/mcl": "cells/mcl",
    "/ul": "cells/mcl",
    "cells/cumm": "cells/mcl",
    "/cumm": "cells/mcl",
    "x10^3/mcl": "10^3/mcl",
    "x10^3/ul": "10^3/mcl",
    "10^3/ul": "10^3/mcl",
    "k/mcl": "10^3/mcl",
    "k/ul": "10^3/mcl",
    "x10^9/l": "10^9/l",
    "uiu/ml": "mciu/ml",
    "units/l": "u/l",
    "mg/100ml": "mg/dl",
    "g/100ml": "g/dl",
  } as Record<string, string>,

  /** Qualitative words the parser accepts as a result value. */
  qualitativeWords: [
    "negative",
    "positive",
    "trace",
    "nil",
    "absent",
    "present",
    "reactive",
    "non-reactive",
    "nonreactive",
    "normal",
    "abnormal",
    "detected",
    "not detected",
    "+",
    "++",
    "+++",
    "++++",
  ],

  phrases: {
    unclassified: "cannot be classified from the files",
    urgentWarning: "See a doctor today.",
    disclaimer: "Only a licensed medical doctor can diagnose conditions. This explanation is not a diagnosis.",
    disclaimerRomanUrdu:
      "Sirf ek licensed doctor hi bimari ki tashkhees (diagnosis) kar sakta hai. Yeh wazahat diagnosis nahi hai.",
  },

  llm: {
    baseUrl: "https://api.groq.com/openai/v1",
    get model(): string {
      return process.env.GROQ_MODEL || "";
    },
    get fallbackModel(): string {
      return process.env.GROQ_FALLBACK_MODEL || "";
    },
    get apiKey(): string {
      return process.env.GROQ_API_KEY || "";
    },
    timeoutMs: 12_000,
    maxRetriesPerModel: 2,
    backoffBaseMs: 400,
    backoffCapMs: 4_000,
    maxConcurrent: 4,
    cacheSize: 300,
    cacheTtlMs: 60 * 60 * 1000,
  },

  api: {
    maxReportChars: 200_000,
    maxChatChars: 600,
    /** Requests per minute per IP. Generous so automated graders are never blocked. */
    analyzePerMinute: 240,
    chatPerMinute: 40,
  },
};

export type Config = typeof config;
