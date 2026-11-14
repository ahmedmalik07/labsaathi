"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ChatReply } from "@/lib/chat";
import type { Explanation, Patient, TestResult } from "@/lib/types";

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
        llm ? "border-teal-300/40 bg-teal-400/10 text-teal-100" : "border-slate-300/40 bg-slate-400/10 text-slate-100"
      }`}
      title={
        llm
          ? `Written by ${explanation.model}. Passed the safety check on attempt ${explanation.guard.attempts}.`
          : explanation.guard.violations.length
            ? `The language model's text failed the safety check (${explanation.guard.violations[0]}), so the built-in template is shown.`
            : "The language model was not available, so the built-in template is shown."
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${llm ? "bg-teal-300" : "bg-slate-300"}`} aria-hidden="true" />
      {llm ? "AI wording, safety-checked" : "Built-in wording (AI unavailable or rejected)"}
    </span>
  );
}

export default function ExplainTabs({ explanation, explanationBusy, patient, results, sessionId, lang }: Props) {
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
    <section className="glass-strong overflow-hidden rounded-3xl" aria-label="Explanation">
      <div role="tablist" aria-label="Explanation views" className="thin-scroll flex gap-1 overflow-x-auto border-b border-white/10 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? "text-slate-950" : "text-slate-200 hover:bg-white/5"}`}
          >
            {tab === t.id && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-2xl bg-teal-300" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
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
              </div>
              <div className={`mt-4 transition-opacity ${explanationBusy ? "opacity-40" : ""}`} aria-busy={explanationBusy}>
                <p className="text-lg leading-relaxed text-white">{explanation.overview}</p>
                <div className="mt-6 grid gap-4">
                  {explanation.tests.map((t) => (
                    <div key={t.test} className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                      <h4 className="font-display text-base font-semibold text-teal-200">{t.test}</h4>
                      <p className="mt-2 text-[0.97rem] leading-relaxed text-slate-100">
                        <span className="font-semibold text-white">{lang === "roman-urdu" ? "Yeh kya naapta hai: " : "What it measures: "}</span>
                        {t.measures}
                      </p>
                      <p className="mt-2 text-[0.97rem] leading-relaxed text-slate-100">
                        <span className="font-semibold text-white">{lang === "roman-urdu" ? "Aap ka result: " : "Your result: "}</span>
                        {t.meaning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-6 flex gap-3 rounded-2xl border border-amber-200/30 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-50">
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
                <p className="text-slate-200">Take these to your appointment. They are based on the results that were not normal.</p>
              </div>
              <ol className="mt-5 grid gap-3">
                {explanation.doctorQuestions.map((q, i) => (
                  <li key={q} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-300 text-sm font-bold text-slate-950">{i + 1}</span>
                    <span className="text-[0.97rem] leading-relaxed text-slate-100">{q}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-sm text-slate-300">{explanation.disclaimer}</p>
            </div>
          )}

          {tab === "chat" && (
            <div>
              <p className="flex items-center gap-2 text-sm text-slate-200">
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-teal-200" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="4" y="9" width="12" height="8" rx="2" />
                  <path d="M7 9V6.5a3 3 0 016 0V9" strokeLinecap="round" />
                </svg>
                Locked to {patient.name ? `${patient.name}'s report` : "this report"}. Questions about anyone else are refused.
              </p>

              <div ref={scroller} className="thin-scroll mt-4 flex max-h-96 min-h-40 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-4" aria-live="polite">
                {messages.length === 0 && <p className="m-auto max-w-sm text-center text-sm text-slate-300">Ask anything about the results above. Answers only use the numbers on this report.</p>}
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "self-end bg-teal-300 text-slate-950"
                        : m.refused
                          ? "self-start border border-violet-300/50 bg-violet-400/15 text-violet-50"
                          : "self-start border border-white/10 bg-white/10 text-slate-50"
                    }`}
                  >
                    {m.refused && <p className="mb-1 text-xs font-semibold tracking-wide text-violet-200 uppercase">Privacy lock</p>}
                    {m.content}
                    {m.citation && (
                      <p className="mt-2 font-mono text-xs text-violet-100">
                        {m.citation.file}:{m.citation.line}
                      </p>
                    )}
                  </motion.div>
                ))}
                {sending && (
                  <div className="self-start rounded-2xl border border-white/10 bg-white/10 px-4 py-3" aria-label="Writing a reply">
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map((d) => (
                        <motion.span key={d} className="h-2 w-2 rounded-full bg-teal-200" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }} />
                      ))}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" disabled={sending} onClick={() => send(s)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-100 transition hover:border-teal-300/60 hover:bg-teal-400/10 disabled:opacity-50">
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
                  className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-teal-300 focus:outline-none"
                />
                <button type="submit" disabled={sending || !draft.trim()} className="rounded-2xl bg-teal-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-teal-200 disabled:opacity-50">
                  Send
                </button>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
