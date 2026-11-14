"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyzeResponse } from "@/lib/pipeline";
import type { Explanation } from "@/lib/types";
import ExplainTabs, { type Lang } from "./ExplainTabs";
import Hero, { type SampleInfo } from "./Hero";
import History, { Profiles } from "./History";
import Logo from "./Logo";
import NeedsInfoForm from "./NeedsInfoForm";
import ResultCard from "./ResultCard";
import { STEP_LABEL } from "./status";
import ScrollStory from "./ScrollStory";
import { useThreeD } from "./useThreeD";

/** WebGL contexts are limited per page, so only the first cards get a 3D tube. */
const MAX_3D_TUBES = 6;

export default function SamjhoApp() {
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
          throw new Error(`${json.error?.message ?? "The report could not be read."}${details}`);
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

  const summaryLine = counts
    ? [
        counts.normal > 0 ? `${counts.normal} normal` : null,
        counts.attention > 0 ? `${counts.attention} to talk to a doctor about` : null,
        counts.open > 0 ? `${counts.open} we could not label` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print fixed inset-x-0 top-0 z-40 border-b border-ink/10 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" aria-label="Samjho home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <div className="flex rounded-full bg-white p-1" role="group" aria-label="Explanation language">
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
                  className={`rounded-full px-3 py-1.5 whitespace-nowrap transition ${lang === id ? "bg-ink text-white" : "text-ink hover:bg-ink/5"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link href="/evals" className="hidden rounded-full bg-white px-4 py-2.5 text-ink transition hover:text-brand md:inline-block">
              Test results
            </Link>
            <a href="#top" className="rounded-full bg-brand px-4 py-2.5 whitespace-nowrap text-white transition hover:bg-brand-dark">
              My report
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <ScrollStory use3D={threeD.enabled} onGiveUp3D={threeD.disable} onStart={() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth" })} />

        <Hero
          samples={samples}
          text={text}
          fileName={fileName}
          busy={busy}
          error={error}
          onText={(t, name) => {
            setText(t);
            setFileName(name);
            setSupplied({});
          }}
          onPick={pick}
          onAnalyze={() => analyze(text, fileName, {}, true)}
        />

        <div ref={resultsRef} className="scroll-mt-20">
          <AnimatePresence>
            {data && explanation && counts && (
              <motion.section key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto grid w-full max-w-6xl gap-6 px-5 pt-4 pb-20 sm:px-8" aria-label="Results">
                {data.urgent && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="urgent-pulse flex flex-col gap-2 rounded-3xl bg-urgent p-5 text-white sm:flex-row sm:items-center sm:gap-5 sm:p-7"
                  >
                    <svg viewBox="0 0 24 24" className="h-12 w-12 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M12 8v5m0 3v.500M3.200 19h17.600L12 3.800 3.200 19z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                      <p className="font-display text-4xl leading-none font-semibold sm:text-5xl">See a doctor today</p>
                      <p className="mt-2 text-lg leading-relaxed text-white/90">{data.urgentMessage?.replace(/^URGENT:\s*/, "")}</p>
                    </div>
                  </motion.div>
                )}

                <div className="flex flex-col gap-1 border-b border-ink/15 pb-5">
                  <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">Report for</p>
                  <h2 className="font-display text-5xl leading-none font-semibold text-ink">{data.patient.name ?? "Name not on the report"}</h2>
                  <p className="mt-2 text-base text-muted">
                    Age <span className={data.patient.age === null ? "font-semibold text-info" : "font-semibold text-ink"}>{data.patient.age ?? "missing"}</span>
                    {" · "}Sex{" "}
                    <span className={data.patient.sex === null ? "font-semibold text-info" : "font-semibold text-ink capitalize"}>{data.patient.sex ?? "missing"}</span>
                    {data.patient.mrn && (
                      <>
                        {" · "}MRN <span className="font-mono text-sm text-ink">{data.patient.mrn}</span>
                      </>
                    )}
                  </p>
                  {data.results.length > 0 && (
                    <p className="mt-1 text-lg text-ink">
                      {data.results.length} {data.results.length === 1 ? "result" : "results"}: {summaryLine}.
                    </p>
                  )}
                  {data.results.length > 0 && (
                    <p className="mt-3">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          [
                            `Lab report summary${data.patient.name ? ` for ${data.patient.name.split(" ")[0]}` : ""} (from Samjho):`,
                            ...(data.urgent ? ["URGENT: see a doctor today."] : []),
                            ...data.results.map((r) => `- ${r.canonicalName}: ${r.rawValue}${r.unit ? " " + r.unit : ""} = ${r.status === "unclassified" ? "cannot be classified" : r.status.replace("_", " ")}`),
                            "Only a licensed doctor can diagnose.",
                          ].join("\n"),
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-ink/25 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-forest hover:text-forest"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-forest" fill="currentColor" aria-hidden="true">
                          <path d="M12 2a10 10 0 00-8.600 15.100L2 22l5-1.300A10 10 0 1012 2zm0 18a8 8 0 01-4.100-1.100l-.300-.200-2.900.800.800-2.800-.200-.300A8 8 0 1112 20zm4.400-5.700c-.200-.100-1.400-.700-1.600-.800s-.400-.100-.500.100-.600.800-.700.900-.300.200-.500.100a6.500 6.500 0 01-3.200-2.800c-.200-.400.200-.400.600-1.200.100-.100 0-.300 0-.400l-.700-1.700c-.200-.400-.400-.400-.500-.400h-.500a.900.900 0 00-.600.300 2.700 2.700 0 00-.800 2c0 1.200.800 2.300 1 2.500s1.700 2.600 4.100 3.600c1.500.600 2.100.700 2.900.600.500-.100 1.400-.600 1.600-1.100s.200-1 .100-1.100-.200-.200-.400-.300z" />
                        </svg>
                        Send summary to family on WhatsApp
                      </a>
                    </p>
                  )}
                </div>

                {data.needsInfo.length > 0 && (
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
                )}

                {data.results.length === 0 ? (
                  <div className="card rounded-3xl p-6">
                    <h3 className="font-display text-3xl font-semibold text-ink">We could not find any test results in that text</h3>
                    <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted">
                      Samjho reads typed reports. Photos, scans and handwriting do not work yet. Check that the text has lines such as &quot;Hemoglobin: 13.5 g/dL&quot;.
                    </p>
                  </div>
                ) : (
                  <div className="grid items-start gap-5 lg:grid-cols-2">
                    {data.results.map((r, i) => (
                      <ResultCard key={`${data.sessionId.slice(-12)}-${i}`} result={r} index={i} use3D={threeD.enabled && i < MAX_3D_TUBES} />
                    ))}
                  </div>
                )}

                {data.results.length > 0 && <History patient={data.patient} results={data.results} reportText={text} complete={data.needsInfo.every((n) => n.blocking.length === 0)} />}

                {data.results.length > 0 && (
                  <ExplainTabs
                    explanation={explanation}
                    explanationBusy={explanationBusy}
                    patient={data.patient}
                    results={data.results}
                    sessionId={data.sessionId}
                    lang={lang}
                    urgentMessage={data.urgentMessage}
                  />
                )}

                <div className="card rounded-3xl">
                  <button type="button" onClick={() => setShowTrace((v) => !v)} aria-expanded={showTrace} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
                    <span>
                      <span className="font-display block text-2xl font-semibold text-ink">What happened behind the scenes</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {data.meta.cleaning.removedPct}% of the file was boilerplate and was dropped · rules took {data.meta.timingsMs.engine} ms · wording by{" "}
                        {data.meta.explanationSource === "llm" ? data.meta.model : "the built-in template"}
                        {data.meta.cached ? " (cached)" : ""}
                      </span>
                    </span>
                    <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-ink transition-transform ${showTrace ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {showTrace && (
                    <ul className="grid gap-2 border-t border-ink/10 p-5 text-sm sm:p-6">
                      {data.trace.map((t, i) => (
                        <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                          <span className="shrink-0 font-semibold text-ink sm:w-40">{STEP_LABEL[t.step] ?? t.step}</span>
                          <span className="leading-relaxed text-muted">{t.detail}</span>
                        </li>
                      ))}
                      {data.meta.tokens && (
                        <li className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                          <span className="shrink-0 font-semibold text-ink sm:w-40">Language model</span>
                          <span className="leading-relaxed text-muted">
                            {data.meta.tokens.prompt} prompt + {data.meta.tokens.completion} completion tokens, {data.meta.timingsMs.llm} ms. It saw only the labelled results: no name, no MRN, no other patient.
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


        <Profiles />
      </main>

      <footer className="no-print border-t border-ink/10 bg-ink text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="max-w-md text-white/85">Samjho explains numbers. Only a licensed medical doctor can diagnose conditions.</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link href="/evals" className="underline underline-offset-4 hover:text-sun">
              Test results
            </Link>
            <a href="/api/health" className="underline underline-offset-4 hover:text-sun">
              System health
            </a>
            <a href="https://github.com/ahmedmalik07/labsaathi" className="underline underline-offset-4 hover:text-sun" rel="noreferrer">
              Source code
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
