/**
 * Privacy lock. Runs in code BEFORE any LLM call.
 *
 * A chat session is bound to exactly one report. If a message names another
 * patient, another MRN or another report, we refuse and cite the safety rules
 * file. The LLM is never asked, so a clever prompt cannot talk its way past it.
 * (The LLM also never receives any other patient's data in the first place.)
 */
import { normName } from "./text";
import type { SourceRef } from "./types";

export interface SessionIdentity {
  name: string | null;
  mrn: string | null;
}

export interface KnownPatient {
  name: string | null;
  mrn: string | null;
  id: string | null;
}

export interface PrivacyVerdict {
  allowed: boolean;
  reason: string | null;
  refusal: string | null;
  source: SourceRef | null;
}

const OTHER_PATIENT_PHRASES: RegExp[] = [
  /\b(?:an)?other\s+(?:patients?|persons?|people|reports?|records?|files?|users?)\b/i,
  /\b(?:different|next|previous|last|second|first|every|each|any)\s+(?:patients?|persons?|reports?|records?)\b/i,
  /\b(?:someone|somebody|anyone|anybody|everyone|everybody)\s+else(?:'s)?\b/i,
  /\ball\s+(?:the\s+|of\s+the\s+|your\s+)?(?:patients|reports|records|files)\b/i,
  /\b(?:list|show|give|tell|share|reveal|display|dump|print)\b[^.?!]{0,40}\b(?:patients|reports|records|mrns)\b/i,
  /\breport[_\s-]?p?\d{2,}\b/i,
  /\bwho\s+else\b/i,
  /\bhow\s+many\s+(?:patients|reports|records)\b/i,
  /\b(?:kisi\s+aur|dus?re|doos?re|dus?ra|doos?ra|baqi|baaqi)\s+(?:patients?|mareez|mariz|shakhs|bande|reports?)\b/i,
  /\b(?:patient|mareez)\s+(?:no\.?|number|#)\s*\d+/i,
];

const STRUCTURED_MRN = /\b[A-Z]{2,5}-[A-Z]?\d{2,}(?:-\d{2,})+\b/gi;
const PATIENT_ID = /\bP-?\d{3,}\b/gi;
const MRN_MENTION = /\b(?:mrn|medical\s+record(?:\s+number)?|record\s+(?:no|number))\b[\s:#]*([A-Z0-9][A-Z0-9-]{2,})/gi;

/** Capitalised words that are not people. */
const NOT_A_NAME = new Set(
  [
    "i", "my", "the", "this", "that", "what", "why", "how", "when", "is", "are", "can", "should", "do", "does", "please", "doctor", "dr", "today",
    "tomorrow", "lab", "labsaathi", "citylab", "report", "test", "result", "normal", "high", "low", "urgent", "male", "female", "english", "urdu",
    "roman", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "hello", "hi", "thanks", "thank", "ok", "okay",
    "kya", "mera", "meri", "mere", "aap", "yeh", "ye", "woh", "kyun", "kaise",
  ],
);

const REPORT_WORDS = "report|results?|tests?|values?|levels?|records?|files?|numbers?|data|readings?|hemoglobin|sugar|platelets?|cholesterol";

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sessionNameTokens(session: SessionIdentity): Set<string> {
  return new Set(normName(session.name ?? "").split(" ").filter(Boolean));
}

function refusal(session: SessionIdentity, source: SourceRef | null): string {
  const who = session.name ? `the report of ${session.name}` : "the report that is open in this session";
  const where = source ? ` (${source.file}, rule 1: Privacy and Data Protection)` : "";
  return `I can only talk about ${who}. I cannot share or discuss any other patient's records${where}. Please ask me about this report instead.`;
}

export function checkPrivacy(
  rawMessage: string,
  session: SessionIdentity,
  options: { known?: KnownPatient[]; testNames?: string[]; source?: SourceRef | null } = {},
): PrivacyVerdict {
  // File names such as report_P002_Bob_Jones.md: underscores would hide word boundaries.
  const message = rawMessage.replace(/_/g, " ");
  const source = options.source ?? null;
  const block = (reason: string): PrivacyVerdict => ({ allowed: false, reason, refusal: refusal(session, source), source });
  const ownTokens = sessionNameTokens(session);
  const ownMrn = squash(session.mrn ?? "");
  const testTokens = new Set((options.testNames ?? []).flatMap((n) => normName(n).split(" ")));

  // 1. Identifiers: MRNs and patient ids that are not this session's.
  const ids = new Set<string>();
  for (const m of message.matchAll(STRUCTURED_MRN)) ids.add(m[0]);
  for (const m of message.matchAll(PATIENT_ID)) ids.add(m[0]);
  for (const m of message.matchAll(MRN_MENTION)) ids.add(m[1]);
  for (const id of ids) {
    const key = squash(id);
    if (!key || !/\d/.test(key)) continue;
    if (ownMrn && ownMrn.includes(key)) continue;
    return block(`The message refers to the identifier "${id}", which is not the MRN of this session's report.`);
  }

  // 2. Phrases that ask about other patients or other reports.
  for (const pattern of OTHER_PATIENT_PHRASES) {
    const m = message.match(pattern);
    if (m) return block(`The message asks about other patients or reports ("${m[0]}").`);
  }

  // 3. Patients we hold records for (parsed from the corpus at build time, not typed in).
  const lower = message.toLowerCase();
  for (const p of options.known ?? []) {
    if (!p.name) continue;
    const tokens = normName(p.name).split(" ").filter(Boolean);
    if (tokens.length === 0 || tokens.every((t) => ownTokens.has(t))) continue;
    if (new RegExp(`\\b${tokens.join("\\s+")}\\b`, "i").test(lower)) {
      return block(`The message names another patient ("${p.name}").`);
    }
    const first = tokens[0];
    if (!ownTokens.has(first) && first.length >= 3) {
      const capitalised = first[0].toUpperCase() + first.slice(1);
      if (new RegExp(`\\b${capitalised}\\b`).test(message)) return block(`The message names another patient ("${capitalised}").`);
    }
    for (const t of tokens.slice(1)) {
      if (!ownTokens.has(t) && new RegExp(`\\b${t}'s\\b`, "i").test(message)) return block(`The message names another patient ("${t}").`);
    }
  }

  // 4. Any other person named next to report words: "Sara Khan's results", "report of Mr Ahmed".
  const isOtherPerson = (candidate: string): boolean => {
    const tokens = normName(candidate).split(" ").filter(Boolean);
    if (tokens.length === 0) return false;
    if (tokens.every((t) => ownTokens.has(t))) return false;
    if (tokens.some((t) => NOT_A_NAME.has(t) || testTokens.has(t))) return false;
    return true;
  };
  const namePatterns: RegExp[] = [
    new RegExp(String.raw`\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]+)?)'s\s+(?:\w+\s+)?(?:${REPORT_WORDS})\b`, "g"),
    new RegExp(String.raw`\b(?:${REPORT_WORDS})\s+(?:of|for|from|about|belonging to)\s+(?:(?:Mr|Mrs|Ms|Miss)\.?\s+)?([A-Z][a-z]{2,}(?:\s[A-Z][a-z]+)?)\b`, "g"),
    /\b(?:patient|Mr|Mrs|Ms|Miss)\.?\s+(?:named\s+|called\s+)?([A-Z][a-z]{2,}(?:\s[A-Z][a-z]+)?)\b/g,
    /\b(?:about|compare(?:d)?\s+(?:with|to)|versus|vs\.?)\s+([A-Z][a-z]{2,}\s[A-Z][a-z]+)\b/g,
  ];
  for (const pattern of namePatterns) {
    for (const m of message.matchAll(pattern)) {
      if (isOtherPerson(m[1])) return block(`The message names another person ("${m[1]}").`);
    }
  }

  return { allowed: true, reason: null, refusal: null, source: null };
}
