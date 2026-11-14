"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const HeroScene = dynamic(() => import("./three/HeroScene"), { ssr: false, loading: () => null });

export interface SampleInfo {
  id: string;
  file: string;
  label: string;
  tests: string[];
}

interface HeroProps {
  samples: SampleInfo[];
  text: string;
  fileName: string | null;
  busy: boolean;
  error: string | null;
  use3D: boolean;
  onGiveUp3D: () => void;
  onText: (text: string, fileName: string | null) => void;
  onPick: (sample: SampleInfo) => void;
  onAnalyze: () => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as const } }),
};

export default function Hero({ samples, text, fileName, busy, error, use3D, onGiveUp3D, onText, onPick, onAnalyze }: HeroProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 400_000) {
      onText("", null);
      return;
    }
    onText(await file.text(), file.name);
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <section className="relative isolate overflow-hidden">
      {/* Background: static gradient first, WebGL on top once it is allowed and loaded. */}
      <div className="hero-static absolute inset-0 -z-20" aria-hidden="true" />
      {use3D && (
        <div className="absolute inset-0 -z-10">
          <HeroScene onGiveUp={onGiveUp3D} />
        </div>
      )}
      <div className="hero-fade pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pt-14 pb-16 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12 lg:pt-24 lg:pb-24">
        <div>
          <motion.p custom={0} variants={fadeUp} initial="hidden" animate="show" className="inline-flex items-center gap-2 rounded-full border border-teal-300/35 bg-teal-400/10 px-3.5 py-1.5 text-sm font-medium text-teal-100">
            <span className="h-2 w-2 rounded-full bg-teal-300" aria-hidden="true" />
            Tech Fusion &apos;26 · Medical Lab Report Explainer
          </motion.p>

          <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="show" className="font-display mt-5 text-4xl leading-[1.08] font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your lab report,
            <br />
            in words you <span className="text-teal-300">actually understand.</span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show" className="mt-5 max-w-xl text-lg leading-relaxed text-slate-200">
            LabSaathi checks every value against the lab&apos;s own reference sheets, shows its working, and explains the result in plain English or Roman Urdu. It never guesses and it never diagnoses.
          </motion.p>

          <motion.ul custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-7 grid max-w-xl gap-3 text-[0.95rem] text-slate-200 sm:grid-cols-2">
            {[
              ["Rules decide, not AI", "Normal, high, low and urgent come from a tested rules engine."],
              ["Every result cites its file", "Open any card to see the range, the file and the line."],
              ["Asks instead of guessing", "Missing age or sex? It asks. It never reads sex from a name."],
              ["Locked to one patient", "The chat cannot be talked into another person's report."],
            ].map(([title, body]) => (
              <li key={title} className="glass rounded-2xl px-4 py-3">
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-sm leading-snug text-slate-300">{body}</p>
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show" className="glass-strong rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-white">Add a report</h2>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white transition hover:border-teal-300/60 hover:bg-teal-400/10"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M3.5 13.5v2a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upload .md or .txt
            </button>
            <input ref={fileInput} type="file" accept=".md,.txt,.markdown,text/plain,text/markdown" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
          </div>

          <label htmlFor="report" className="sr-only">
            Report text
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              readFile(e.dataTransfer.files?.[0]);
            }}
            className={`mt-4 rounded-2xl border transition ${dragging ? "border-teal-300 bg-teal-400/10" : "border-white/15 bg-black/25"}`}
          >
            <textarea
              id="report"
              value={text}
              onChange={(e) => onText(e.target.value, null)}
              rows={7}
              spellCheck={false}
              placeholder={"Paste the report text here, drop a file, or pick a sample below.\n\nExample:\nPatient Name: ...\nAge: 42   Sex: Female\n- Hemoglobin: 6.5 g/dL"}
              className="thin-scroll block h-44 w-full resize-none rounded-2xl bg-transparent p-4 font-mono text-[0.82rem] leading-relaxed text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2 text-xs text-slate-300">
              <span className="truncate">{fileName ? fileName : "Pasted text"}</span>
              <span className="shrink-0 tabular-nums">{words.toLocaleString()} words</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-200">Or try one of the 14 sample reports</p>
            <div className="thin-scroll mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
              {samples.length === 0 &&
                Array.from({ length: 8 }, (_, i) => <span key={i} className="skeleton h-8 w-28 rounded-full" aria-hidden="true" />)}
              {samples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setLoadingId(s.id);
                    try {
                      await onPick(s);
                    } finally {
                      setLoadingId(null);
                    }
                  }}
                  title={`${s.file}\nTests: ${s.tests.join(", ")}`}
                  className={`rounded-full border px-3 py-1.5 text-left text-sm transition disabled:opacity-60 ${
                    fileName === s.file ? "border-teal-300 bg-teal-400/15 text-white" : "border-white/15 bg-white/5 text-slate-100 hover:border-teal-300/60 hover:bg-teal-400/10"
                  }`}
                >
                  <span className="font-mono text-xs text-teal-200">{s.id}</span> {loadingId === s.id ? "Loading..." : s.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-300/50 bg-red-500/15 px-4 py-3 text-sm text-red-50">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onAnalyze}
            disabled={busy || !text.trim()}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-300 px-5 py-3.5 text-base font-semibold text-slate-950 shadow-[0_10px_40px_-10px_rgba(45,212,191,0.7)] transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" aria-hidden="true" />
                Checking against the lab&apos;s sheets...
              </>
            ) : (
              <>
                Explain this report
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="M4 10h12m0 0l-4.5-4.5M16 10l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-slate-300">
            Only the lab&apos;s own files are used as the knowledge source. Your name and MRN are never sent to the language model.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
