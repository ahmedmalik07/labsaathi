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

export const DEMO_FILES = [
  { file: "demo_1_ayesha_full_checkup.md", label: "Ayesha: full check-up, one urgent result" },
  { file: "demo_2_bilal_missing_details.md", label: "Bilal: age and sex missing" },
  { file: "demo_3_sana_messy_layout.md", label: "Sana: messy layout, unknown test" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.07 * i, ease: [0.22, 1, 0.36, 1] as const } }),
};

export default function Hero({ samples, text, fileName, busy, error, use3D, onGiveUp3D, onText, onPick, onAnalyze }: HeroProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 400_000) {
      setTooBig(true);
      return;
    }
    setTooBig(false);
    onText(await file.text(), file.name);
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <section id="top" className="relative isolate overflow-hidden">
      <div className="hero-static absolute inset-0 -z-20" aria-hidden="true" />
      {use3D && (
        <div className="absolute inset-0 -z-10">
          <HeroScene onGiveUp={onGiveUp3D} />
        </div>
      )}
      <div className="hero-fade pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pt-10 pb-14 sm:px-8 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-14 lg:pt-16 lg:pb-20">
        <div className="lg:pt-6">
          <motion.p custom={0} variants={fadeUp} initial="hidden" animate="show" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold tracking-[0.16em] text-ink uppercase">
            <span className="h-2.5 w-2.5 rounded-full bg-forest" aria-hidden="true" />
            For CityLab reports · English and Roman Urdu
          </motion.p>

          <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="show" className="font-display mt-6 text-[3.4rem] leading-[0.98] font-semibold tracking-tight text-ink sm:text-7xl lg:text-[5.2rem]">
            Got a lab report you can&apos;t read?
            <br />
            <span className="text-brand">Samjho.</span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show" className="mt-6 max-w-xl text-xl leading-relaxed text-ink/80">
            Paste your report. We check every number against the lab&apos;s own range sheets, tell you what is normal and what is not, and give you questions to take to your doctor.
          </motion.p>

          <motion.a custom={3} variants={fadeUp} initial="hidden" animate="show" href="#story" className="mt-9 hidden items-center gap-4 lg:inline-flex">
            <span className="flex h-16 w-10 items-start justify-center rounded-full border-2 border-ink bg-white pt-2.5" aria-hidden="true">
              <motion.span className="h-2.5 w-1.5 rounded-full bg-brand" animate={{ y: [0, 14, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
            </span>
            <span>
              <span className="font-display block text-2xl font-semibold text-ink">Or scroll for the story</span>
              <span className="block text-sm font-medium text-muted">Why a report needs explaining at all.</span>
            </span>
          </motion.a>
        </div>

        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show" className="card-strong rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl font-semibold text-ink">Your report</h2>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-ink/25 bg-white px-3.5 py-1.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M10 13V3m0 0L6.500 6.500M10 3l3.500 3.500M3.500 13.500v2a1.500 1.500 0 001.500 1.500h10a1.500 1.500 0 001.500-1.500v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upload file
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
            className={`mt-4 rounded-2xl border transition ${dragging ? "border-brand bg-brand/5" : "border-ink/20 bg-cream/50"}`}
          >
            <textarea
              id="report"
              value={text}
              onChange={(e) => onText(e.target.value, null)}
              rows={6}
              spellCheck={false}
              placeholder={"Paste the report here, or drop a .md / .txt file.\n\nPatient Name: ...\nAge: 42    Sex: Female\n- Hemoglobin: 6.5 g/dL"}
              className="thin-scroll block h-40 w-full resize-none rounded-2xl bg-transparent p-4 font-mono text-[0.82rem] leading-relaxed text-ink placeholder:text-muted focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-2 text-xs text-muted">
              <span className="truncate">{fileName ? fileName : "Pasted text"}</span>
              <span className="shrink-0 tabular-nums">{words.toLocaleString()} words</span>
            </div>
          </div>
          {tooBig && <p className="mt-2 text-sm text-urgent">That file is too large. Reports are text files of a few pages.</p>}

          <button
            type="button"
            onClick={onAnalyze}
            disabled={busy || !text.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-lg font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Reading it against the lab&apos;s sheets
              </>
            ) : (
              "Explain my report"
            )}
          </button>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-urgent/40 bg-urgent/10 px-4 py-3 text-sm text-urgent">
              {error}
            </p>
          )}

          <div className="mt-6 border-t border-ink/10 pt-4">
            <p className="text-sm font-semibold text-ink">No report on you? Try one of the lab&apos;s 14 samples</p>
            <div className="thin-scroll mt-2.5 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
              {samples.length === 0 && Array.from({ length: 8 }, (_, i) => <span key={i} className="skeleton h-8 w-28 rounded-full" aria-hidden="true" />)}
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
                  className={`rounded-full border px-3 py-1.5 text-left text-sm font-medium transition disabled:opacity-60 ${
                    fileName === s.file ? "border-ink bg-ink text-white" : "border-ink/20 bg-white text-ink hover:border-brand hover:text-brand"
                  }`}
                >
                  {loadingId === s.id ? "Loading..." : s.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">
              Demo files to download:{" "}
              {DEMO_FILES.map((d, i) => (
                <span key={d.file}>
                  <a href={`/demo/${d.file}`} download className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-2 hover:text-brand">
                    {d.label.split(":")[0]}
                  </a>
                  {i < DEMO_FILES.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
