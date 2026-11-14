"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyzeResponse } from "@/lib/pipeline";
import type { Explanation } from "@/lib/types";
import ExplainTabs, { type Lang } from "./ExplainTabs";
import Hero, { type SampleInfo } from "./Hero";
import NeedsInfoForm from "./NeedsInfoForm";
import ResultCard from "./ResultCard";
import { STATUS, STEP_LABEL } from "./status";
import { useThreeD } from "./useThreeD";

/** WebGL contexts are limited per page, so only the first cards get a 3D tube. */
const MAX_3D_TUBES = 6;

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-300 text-slate-950" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 2.5c3.4 4.1 6 7.4 6 10.6A6 6 0 016 13.1c0-3.2 2.6-6.5 6-10.600z" />
        </svg>
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-white">
        Lab<span className="text-teal-300">Saathi</span>
      </span>
    </span>
  );
}

export default function LabSaathiApp() {
  const threeD = useThreeD();
  const [samples, setSamples] = useState<SampleInfo[]>([]);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [supplied, setSupplied] = useState<{ age?: string; sex?: string }>({});
  const [lang, setLang] = useState<Lang>("en");
  const [explanations, setExplanations] = useState<Partial<Record<Lang, Explanation>>>({});
  const [explanationBusy, setExplanationBusy] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/samples")
      .then((r) => r.json())
      .then((j) => setSamples(j.samples ?? []))
      .catch(() => setSamples([]));
  }, []);

  const analyze = useCallback(
    async (reportText: string, name: string | null, extra: { age?: string; sex?: string }, scroll: boolean) => {
      if (!reportText.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportText, fileName: name ?? undefined, age: extra.age, sex: extra.sex, lang }),
        });
        const json = await res.json();
        if (!res.ok) {
          const details = Array.isArray(json.error?.details) ? ` ${json.error.details.map((d: { problem: string }) => d.problem).join(" ")}` : "";
          throw new Error(`${json.error?.message ?? "The report could not be analysed."}${details}`);
        }
        const out = json as AnalyzeResponse;
        setData(out);
        setExplanations({ [out.explanationDetail.lang]: out.explanationDetail });
        setShowTrace(false);
        if (scroll) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [lang],
  );

  const pick = useCallback(
    async (sample: SampleInfo) => {
      setError(null);
      try {
        const res = await fetch(`/api/samples/${sample.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "The sample could not be loaded.");
        setText(json.reportText);
        setFileName(sample.file);
        setSupplied({});
        await analyze(json.reportText, sample.file, {}, true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The sample could not be loaded.");
      }
    },
    [analyze],
  );

  // Language toggle: ask the server to explain the same session in the other language.
  const switchLang = useCallback(
    async (next: Lang) => {
      setLang(next);
      if (!data || explanations[next]) return;
      setExplanationBusy(true);
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: data.sessionId, lang: next }),
        });
        const json = await res.json();
        if (res.ok) setExplanations((prev) => ({ ...prev, [next]: json.explanationDetail as Explanation }));
      } finally {
        setExplanationBusy(false);
      }
    },
    [data, explanations],
  );

  const explanation = data ? (explanations[lang] ?? data.explanationDetail) : null;
  const counts = data
    ? {
        normal: data.results.filter((r) => r.status === "normal").length,
        attention: data.results.filter((r) => ["low", "high", "abnormal", "urgent"].includes(r.status)).length,
        open: data.results.filter((r) => ["needs_info", "unclassified"].includes(r.status)).length,
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-white/10 bg-[#050816]/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" aria-label="LabSaathi home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <div className="flex rounded-full border border-white/15 bg-white/5 p-0.5" role="group" aria-label="Explanation language">
              {(
                [
                  ["en", "English"],
                  ["roman-urdu", "Roman Urdu"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={lang === id}
                  onClick={() => switchLang(id)}
                  className={`rounded-full px-2.5 py-1.5 whitespace-nowrap transition sm:px-3 ${lang === id ? "bg-teal-300 text-slate-950" : "text-slate-100 hover:bg-white/10"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link href="/evals" className="hidden rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-slate-100 transition hover:border-teal-300/60 hover:bg-teal-400/10 sm:inline-block">
              Live evals
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="no-print">
          <Hero
            samples={samples}
            text={text}
            fileName={fileName}
            busy={busy}
            error={error}
            use3D={threeD.enabled}
            onGiveUp3D={threeD.disable}
            onText={(t, name) => {
              setText(t);
              setFileName(name);
              setSupplied({});
            }}
            onPick={pick}
            onAnalyze={() => analyze(text, fileName, {}, true)}
          />
        </div>

        <div ref={resultsRef} className="scroll-mt-20">
          <AnimatePresence>
            {data && explanation && counts && (
              <motion.section
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-20 sm:px-8"
                aria-label="Results"
              >
                {data.urgent && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="no-print urgent-pulse flex flex-col gap-2 rounded-3xl border border-red-200/60 bg-red-600 p-5 text-white sm:flex-row sm:items-center sm:gap-5 sm:p-6"
                  >
                    <svg viewBox="0 0 24 24" className="h-11 w-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M12 8v5m0 3v.5M3.2 19h17.6L12 3.8 3.200 19z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                      <p className="font-display text-2xl font-semibold sm:text-3xl">See a doctor today</p>
                      <p className="mt-1 text-base leading-relaxed text-red-50">{data.urgentMessage}</p>
                    </div>
                  </motion.div>
                )}

                <div className="no-print glass flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-teal-200">Report for</p>
                    <h2 className="font-display truncate text-2xl font-semibold text-white">{data.patient.name ?? "Name not on the report"}</h2>
                    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-200">
                      {(
                        [
                          ["Age", data.patient.age ?? "missing"],
                          ["Sex", data.patient.sex ?? "missing"],
                          ["MRN", data.patient.mrn ?? "missing"],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex gap-1.5">
                          <dt className="text-slate-400">{k}</dt>
                          <dd className={v === "missing" ? "font-semibold text-violet-200" : "font-medium text-white capitalize"}>{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className={`rounded-full border px-3 py-1.5 font-medium ${STATUS.normal.pill}`}>{counts.normal} normal</span>
                    <span className={`rounded-full border px-3 py-1.5 font-medium ${data.urgent ? STATUS.urgent.pill : STATUS.high.pill}`}>{counts.attention} need attention</span>
                    {counts.open > 0 && <span className={`rounded-full border px-3 py-1.5 font-medium ${STATUS.unclassified.pill}`}>{counts.open} not labelled</span>}
                  </div>
                </div>

                {data.needsInfo.length > 0 && (
                  <div className="no-print">
                    <NeedsInfoForm
                      key={data.sessionId}
                      needsInfo={data.needsInfo}
                      busy={busy}
                      onSubmit={(values) => {
                        const merged = { ...supplied, ...values };
                        setSupplied(merged);
                        analyze(text, fileName, merged, false);
                      }}
                    />
                  </div>
                )}

                {data.results.length === 0 ? (
                  <div className="no-print glass rounded-3xl p-6 text-slate-100">
                    <h3 className="font-display text-lg font-semibold text-white">No test results could be read from this text</h3>
                    <p className="mt-2 leading-relaxed text-slate-200">
                      LabSaathi reads typed reports. Scanned images and handwriting are not supported. Check that the text includes lines such as &quot;Hemoglobin: 13.5 g/dL&quot;.
                    </p>
                  </div>
                ) : (
                  <div className="no-print grid items-start gap-5 lg:grid-cols-2">
                    {data.results.map((r, i) => (
                      <ResultCard key={`${data.sessionId.slice(-12)}-${i}`} result={r} index={i} use3D={threeD.enabled && i < MAX_3D_TUBES} />
                    ))}
                  </div>
                )}

                {data.results.length > 0 && (
                  <ExplainTabs explanation={explanation} explanationBusy={explanationBusy} patient={data.patient} results={data.results} sessionId={data.sessionId} lang={lang} urgentMessage={data.urgentMessage} />
                )}

                <div className="no-print glass rounded-3xl">
                  <button type="button" onClick={() => setShowTrace((v) => !v)} aria-expanded={showTrace} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
                    <span>
                      <span className="font-display block text-lg font-semibold text-white">Report trace</span>
                      <span className="mt-0.5 block text-sm text-slate-300">
                        Cleaner removed {data.meta.cleaning.removedPct}% boilerplate · engine {data.meta.timingsMs.engine} ms · total {data.meta.timingsMs.total} ms ·{" "}
                        {data.meta.explanationSource === "llm" ? data.meta.model : "template"}
                        {data.meta.cached ? " (cached)" : ""}
                      </span>
                    </span>
                    <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-teal-200 transition-transform ${showTrace ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {showTrace && (
                    <ul className="grid gap-2 border-t border-white/10 p-5 text-sm sm:p-6">
                      {data.trace.map((t, i) => (
                        <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                          <span className="shrink-0 font-semibold text-teal-200 sm:w-40">{STEP_LABEL[t.step] ?? t.step}</span>
                          <span className="leading-relaxed text-slate-200">{t.detail}</span>
                        </li>
                      ))}
                      {data.meta.tokens && (
                        <li className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                          <span className="shrink-0 font-semibold text-teal-200 sm:w-40">Language model</span>
                          <span className="leading-relaxed text-slate-200">
                            {data.meta.tokens.prompt} prompt + {data.meta.tokens.completion} completion tokens, {data.meta.timingsMs.llm} ms. The model saw only the engine output: no name, no MRN, no other patient.
                          </span>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="no-print border-t border-white/10 bg-black/20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>LabSaathi explains numbers. Only a licensed medical doctor can diagnose conditions.</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/evals" className="text-teal-200 hover:underline">
              Live evals
            </Link>
            <a href="/api/health" className="text-teal-200 hover:underline">
              System health
            </a>
            <a href="https://github.com/ahmedmalik07/labsaathi" className="text-teal-200 hover:underline" rel="noreferrer">
              Source
            </a>
            <span className="text-slate-400">{threeD.enabled ? "3D on" : `3D off (${threeD.reason})`}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
