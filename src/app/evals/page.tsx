"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { EvalResult } from "@/lib/evals";

interface EvalRun {
  total: number;
  passed: number;
  failed: number;
  ms: number;
  ranAt: string;
  results: EvalResult[];
}

interface Health {
  status: string;
  message: string;
  llm: { model: string | null; fallbackModel: string | null; reachable: boolean; stats: { calls: number; cacheHits: number; retries: number; fallbacks: number; rateLimited: number } };
  knowledgeBase: { files: number; boilerplateRemovedPct: number; aliases: number; ranges: number; urgentThresholds: number; rules: number };
}

export default function EvalsPage() {
  const [run, setRun] = useState<EvalRun | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const fetchRun = useCallback(async (): Promise<{ run: EvalRun | null; health: Health | null; error: string | null }> => {
    try {
      const [evals, h] = await Promise.all([fetch("/api/evals", { cache: "no-store" }), fetch("/api/health", { cache: "no-store" })]);
      if (!evals.ok) return { run: null, health: null, error: `The eval run failed (HTTP ${evals.status}).` };
      return { run: await evals.json(), health: h.ok ? await h.json() : null, error: null };
    } catch (e) {
      return { run: null, health: null, error: e instanceof Error ? e.message : "The eval run failed." };
    }
  }, []);

  const apply = useCallback((r: { run: EvalRun | null; health: Health | null; error: string | null }) => {
    if (r.run) setRun(r.run);
    if (r.health) setHealth(r.health);
    setError(r.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchRun().then((r) => {
      if (alive) apply(r);
    });
    return () => {
      alive = false;
    };
  }, [fetchRun, apply]);

  const load = async () => {
    setLoading(true);
    setError(null);
    apply(await fetchRun());
  };

  const groups = run ? [...new Set(run.results.map((r) => r.group))] : [];
  const allPass = run ? run.failed === 0 : false;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050816]/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight text-white">
            Lab<span className="text-teal-300">Saathi</span>
          </Link>
          <Link href="/" className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-100 transition hover:border-teal-300/60 hover:bg-teal-400/10">
            Back to the app
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
        <p className="text-sm font-medium text-teal-200">Live evals</p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Is the rules engine right, right now?</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-slate-200">
          This page runs the acceptance cases against the deployed rules engine every time it loads. The same list is the Vitest suite in the repository, which adds generated tests for every boundary of every range row. No language model is involved in any of these
          checks.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className={`glass rounded-3xl p-5 ${run ? (allPass ? "border-emerald-300/40" : "border-red-300/50") : ""}`}>
            <p className="text-sm text-slate-300">Cases passing</p>
            <p className="font-display mt-1 text-4xl font-semibold text-white tabular-nums">{run ? `${run.passed} / ${run.total}` : loading ? "..." : "n/a"}</p>
            {run && <p className={`mt-1 text-sm font-medium ${allPass ? "text-emerald-200" : "text-red-200"}`}>{allPass ? "All green" : `${run.failed} failing`}</p>}
          </div>
          <div className="glass rounded-3xl p-5">
            <p className="text-sm text-slate-300">Engine time for the whole run</p>
            <p className="font-display mt-1 text-4xl font-semibold text-white tabular-nums">{run ? `${run.ms} ms` : loading ? "..." : "n/a"}</p>
            {run && <p className="mt-1 text-sm text-slate-300">Ran at {new Date(run.ranAt).toLocaleTimeString()}</p>}
          </div>
          <div className="glass rounded-3xl p-5">
            <p className="text-sm text-slate-300">Language model</p>
            <p className="font-display mt-1 truncate text-xl font-semibold text-white">{health ? (health.llm.reachable ? "Reachable" : "Unavailable") : loading ? "..." : "n/a"}</p>
            {health && (
              <p className="mt-1 text-sm leading-snug text-slate-300">
                {health.llm.model ?? "no model set"}
                <br />
                fallback {health.llm.fallbackModel ?? "none"}
              </p>
            )}
          </div>
        </div>

        {health && (
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Knowledge base built from {health.knowledgeBase.files} files ({health.knowledgeBase.boilerplateRemovedPct}% boilerplate removed): {health.knowledgeBase.ranges} range rows, {health.knowledgeBase.aliases} aliases,{" "}
            {health.knowledgeBase.urgentThresholds} urgent thresholds, {health.knowledgeBase.rules} cited rules. Since this server instance started: {health.llm.stats.calls} model calls, {health.llm.stats.cacheHits} cache hits,{" "}
            {health.llm.stats.retries} retries, {health.llm.stats.fallbacks} fallbacks, {health.llm.stats.rateLimited} rate-limit responses.
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={load} disabled={loading} className="rounded-full bg-teal-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-200 disabled:opacity-50">
            {loading ? "Running..." : "Run again"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-200">
              {error}
            </p>
          )}
        </div>

        {loading && !run && (
          <div className="mt-8 grid gap-3" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-14 rounded-2xl" />
            ))}
          </div>
        )}

        {run &&
          groups.map((group) => {
            const rows = run.results.filter((r) => r.group === group);
            const ok = rows.filter((r) => r.pass).length;
            return (
              <section key={group} className="mt-9">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold text-white capitalize">{group}</h2>
                  <p className={`text-sm font-medium tabular-nums ${ok === rows.length ? "text-emerald-200" : "text-red-200"}`}>
                    {ok} / {rows.length}
                  </p>
                </div>
                <ul className="mt-3 grid gap-2">
                  {rows.map((r) => (
                    <li key={r.id} className={`glass overflow-hidden rounded-2xl ${r.pass ? "" : "border-red-300/50"}`}>
                      <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${r.pass ? "bg-emerald-300 text-slate-950" : "bg-red-400 text-slate-950"}`}>{r.pass ? "PASS" : "FAIL"}</span>
                        <span className="shrink-0 font-mono text-xs text-teal-200">{r.id}</span>
                        <span className="min-w-0 flex-1 text-[0.95rem] text-slate-100">{r.title}</span>
                        <span className="hidden shrink-0 text-xs text-slate-400 tabular-nums sm:inline">{r.checks.length} checks</span>
                      </button>
                      <AnimatePresence initial={false}>
                        {open === r.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <ul className="grid gap-1.5 border-t border-white/10 bg-black/20 px-4 py-3 text-sm">
                              {r.checks.map((c, i) => (
                                <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                  <span className={c.pass ? "text-emerald-300" : "text-red-300"} aria-hidden="true">
                                    {c.pass ? "✓" : "✗"}
                                  </span>
                                  <span className="text-slate-100">{c.label}</span>
                                  <span className="font-mono text-xs text-slate-300">
                                    want {c.want}
                                    {!c.pass && <> · got {c.got}</>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
      </main>

      <footer className="border-t border-white/10 bg-black/20 px-5 py-6 text-center text-sm text-slate-300">
        Run the full suite locally with <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white">npm test</code>.
      </footer>
    </div>
  );
}
