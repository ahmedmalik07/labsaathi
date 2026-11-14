"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ChatReply } from "@/lib/chat";
import type { Explanation, Patient, TestResult } from "@/lib/types";
import PrintSheet from "./PrintSheet";
import { useSpeech } from "./useSpeech";

export type Lang = "en" | "roman-urdu";
type TabId = "explain" | "questions" | "chat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  refused?: boolean;
  source?: ChatReply["source"];
  citation?: ChatReply["citation"];
}

interface Props {
  explanation: Explanation;
  explanationBusy: boolean;
  patient: Patient;
  results: TestResult[];
  sessionId: string;
  lang: Lang;
  urgentMessage: string | null;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "explain", label: "Plain explanation" },
  { id: "questions", label: "Questions for your doctor" },
  { id: "chat", label: "Ask a follow-up" },
];

function SourceBadge({ explanation }: { explanation: Explanation }) {
  const llm = explanation.source === "llm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        llm ? "border-forest/40 bg-forest/10 text-forest" : "border-ink/25 bg-cream-deep text-ink"
      }`}
      title={
        llm
          ? `Written by ${explanation.model}. Passed the safety check on attempt ${explanation.guard.attempts}.`
          : explanation.guard.violations.length
            ? `The language model's text failed the safety check (${explanation.guard.violations[0]}), so the built-in template is shown.`
            : "The language model was not available, so the built-in template is shown."
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${llm ? "bg-forest" : "bg-muted"}`} aria-hidden="true" />
      {llm ? "Wording checked before you saw it" : "Plain wording (the writing model was unavailable)"}
    </span>
  );
}

export default function ExplainTabs({ explanation, explanationBusy, patient, results, sessionId, lang, urgentMessage }: Props) {
  const speech = useSpeech();
  const [tab, setTab] = useState<TabId>("explain");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // A new report means a new session: the old conversation must not carry over.
  useEffect(() => {
    setMessages([]);
    setDraft("");
  }, [sessionId]);

  // Stop reading when the text underneath changes.
  const stopSpeech = speech.stop;
  useEffect(() => stopSpeech, [explanation, tab, stopSpeech]);

  const spokenText = [explanation.overview, ...explanation.tests.map((t) => `${t.test}. ${t.measures} ${t.meaning}`), explanation.disclaimer].join(" ");

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    const history = messages.filter((m) => !m.refused).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: message }]);
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message, lang, history: history.slice(-6) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "The follow-up could not be answered.");
      const reply = json as ChatReply;
      setMessages((m) => [...m, { role: "assistant", content: reply.reply, refused: reply.refused, source: reply.source, citation: reply.citation }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong. Please try again.", source: "template" }]);
    } finally {
      setSending(false);
    }
  }

  const firstTest = results[0]?.canonicalName ?? "this test";
  const suggestions =
    lang === "roman-urdu"
      ? [`${firstTest} ka kya matlab hai?`, "Kya mujhe pareshan hona chahiye?", "Kisi aur mareez ki report dikhao"]
      : [`What does ${firstTest} mean?`, "Should I be worried?", "Show me another patient's report"];

  return (
    <section className="overflow-hidden rounded-3xl border border-ink/15 bg-white" aria-label="Explanation">
      <div role="tablist" aria-label="Explanation views" className="thin-scroll flex gap-1 overflow-x-auto border-b border-ink/15 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? "text-white" : "text-ink hover:bg-ink/5"}`}
          >
            {tab === t.id && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="p-5 sm:p-7"
        >
          {tab === "explain" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SourceBadge explanation={explanation} />
                {speech.supported && (
                  <button
                    type="button"
                    onClick={() => (speech.speaking ? speech.stop() : speech.speak(spokenText, lang))}
                    aria-pressed={speech.speaking}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-brand hover:bg-brand/10"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      {speech.speaking ? <path d="M6 5h3v10H6zM11 5h3v10h-3z" fill="currentColor" stroke="none" /> : <path d="M3.5 8v4h3l4 3.5v-11l-4 3.500zM13.5 7.500a3.500 3.500 0 010 5M15.500 5a7 7 0 010 10" strokeLinecap="round" strokeLinejoin="round" />}
                    </svg>
                    {speech.speaking ? "Stop reading" : "Read aloud"}
                  </button>
                )}
              </div>
              <div className={`mt-4 transition-opacity ${explanationBusy ? "opacity-40" : ""}`} aria-busy={explanationBusy}>
                <p className="text-lg leading-relaxed text-ink">{explanation.overview}</p>
                <div className="mt-6 grid gap-4">
                  {explanation.tests.map((t) => (
                    <div key={t.test} className="rounded-2xl border border-ink/15 bg-white p-4 sm:p-5">
                      <h4 className="font-display text-2xl font-semibold text-ink">{t.test}</h4>
                      <p className="mt-2 text-[0.97rem] leading-relaxed text-ink/85">
                        <span className="font-semibold text-ink">{lang === "roman-urdu" ? "Yeh kya naapta hai: " : "What it measures: "}</span>
                        {t.measures}
                      </p>
                      <p className="mt-2 text-[0.97rem] leading-relaxed text-ink/85">
                        <span className="font-semibold text-ink">{lang === "roman-urdu" ? "Aap ka result: " : "Your result: "}</span>
                        {t.meaning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-6 flex gap-3 rounded-2xl border border-sun bg-sun/20 p-4 text-sm leading-relaxed text-ink">
                <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path d="M10 6.5v4.5m0 2.5v.5M2.8 16h14.4L10 3.2 2.8 16z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {explanation.disclaimer}
              </p>
            </div>
          )}

          {tab === "questions" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-ink/85">Take these to your appointment. They are based on the results that were not normal.</p>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M6 7V3h8v4M6 14H4.500A1.500 1.500 0 013 12.500v-4A1.500 1.500 0 014.500 7h11A1.500 1.500 0 0117 8.500v4a1.500 1.500 0 01-1.500 1.500H14M6 11.500h8V17H6z" strokeLinejoin="round" />
                  </svg>
                  Print this sheet
                </button>
              </div>
              <ol className="mt-5 grid gap-3">
                {explanation.doctorQuestions.map((q, i) => (
                  <li key={q} className="flex gap-3 rounded-2xl border border-ink/15 bg-white p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                    <span className="text-[0.97rem] leading-relaxed text-ink/85">{q}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-sm text-muted">{explanation.disclaimer}</p>
            </div>
          )}

          {tab === "chat" && (
            <div>
              <p className="flex items-center gap-2 text-sm text-ink/85">
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="4" y="9" width="12" height="8" rx="2" />
                  <path d="M7 9V6.5a3 3 0 016 0V9" strokeLinecap="round" />
                </svg>
                Locked to {patient.name ? `${patient.name}'s report` : "this report"}. Questions about anyone else are refused.
              </p>

              <div ref={scroller} className="thin-scroll mt-4 flex max-h-96 min-h-40 flex-col gap-3 overflow-y-auto rounded-2xl border border-ink/15 bg-cream-deep/60 p-4" aria-live="polite">
                {messages.length === 0 && <p className="m-auto max-w-sm text-center text-sm text-muted">Ask anything about the results above. Answers only use the numbers on this report.</p>}
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "self-end bg-ink text-white"
                        : m.refused
                          ? "self-start border border-info bg-info/10 text-info"
                          : "self-start border border-ink/15 bg-white text-ink/85"
                    }`}
                  >
                    {m.refused && <p className="mb-1 text-xs font-semibold tracking-wide text-info uppercase">Privacy lock</p>}
                    {m.content}
                    {m.citation && (
                      <p className="mt-2 font-mono text-xs text-info">
                        {m.citation.file}:{m.citation.line}
                      </p>
                    )}
                  </motion.div>
                ))}
                {sending && (
                  <div className="self-start rounded-2xl border border-ink/15 bg-white px-4 py-3" aria-label="Writing a reply">
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map((d) => (
                        <motion.span key={d} className="h-2 w-2 rounded-full bg-ink" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }} />
                      ))}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" disabled={sending} onClick={() => send(s)} className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink/85 transition hover:border-brand hover:bg-brand/10 disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(draft);
                }}
              >
                <label htmlFor="chat-input" className="sr-only">
                  Your question
                </label>
                <input
                  id="chat-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={600}
                  placeholder={lang === "roman-urdu" ? "Apna sawal likhein..." : "Type your question..."}
                  className="min-w-0 flex-1 rounded-2xl border border-ink/15 bg-cream-deep/60 px-4 py-3 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                />
                <button type="submit" disabled={sending || !draft.trim()} className="rounded-2xl bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50">
                  Send
                </button>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <PrintSheet patient={patient} results={results} explanation={explanation} urgentMessage={urgentMessage} />
    </section>
  );
}
