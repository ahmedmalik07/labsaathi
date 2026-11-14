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

const GROUPS: Record<string, { title: string; about: string }> = {
  "sample reports": { title: "The 14 reports the organisers gave us", about: "Every sample report, read from the original file, with the answer the brief says is right." },
  "urgent thresholds": { title: "Right on the danger limits", about: "Values exactly on, just under and past the lab's urgent limits (7.0, 300, 50,000, 1,000)." },
  "age limits": { title: "Ages and missing details", about: "Ages 17, 18, 100 and 101, blank or unreadable ages, and a male-sounding name with no sex given." },
  "units and names": { title: "Short forms and units", about: "Lowercase aliases, units it cannot convert, mmol/L, qualitative results, names not in the glossary." },
  layouts: { title: "Messy report layouts", about: "Layouts the samples never used: dotted lines, '=' signs, reordered tables, one-line demographics." },
  privacy: { title: "Asking about another patient", about: "Chat messages that try to reach someone else's report. They must be refused." },
};

/** Turns raw check values into words a person can read. */
function plain(v: string): string {
  let t = v.replace(/^"|"$/g, "");
  const words: Record<string, string> = {
    needs_info: "asks for missing details",
    unclassified: "cannot be classified",
    normal: "normal",
    low: "low",
    high: "high",
    urgent: "urgent",
    abnormal: "abnormal",
    true: "yes",
    false: "no",
    null: "missing",
    "[]": "nothing",
    context: "matched by context",
    alias: "glossary alias",
    normalized: "matched after ignoring plurals and word order",
    exact: "exact name",
    none: "no match",
  };
  if (t in words) return words[t];
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(v) as string[];
      return arr.length ? arr.join(" and ") : "nothing";
    } catch {
      /* keep as is */
    }
  }
  t = t.replace(/^patient\./, "");
  return t;
}

function plainLabel(label: string): string {
  if (label === "number of tests found") return "Number of tests read from the report";
  return label
    .replace(/ status$/, ": result")
    .replace(/ direction$/, ": low or high")
    .replace(/ converted value$/, ": value after unit conversion")
    .replace(/ original name$/, ": name as written on the report")
    .replace(/ matched by$/, ": how the name was matched")
    .replace(/ carries a question$/, ": asks the user a question")
    .replace(/ carries the doctor warning$/, ": shows 'see a doctor today'")
    .replace(/ trace has steps$/, ": shows its working")
    .replace(/ found$/, ": found on the report")
    .replace(/^patient\.name$/, "Patient name read")
    .replace(/^patient\.age$/, "Patient age read")
    .replace(/^patient\.sex$/, "Patient sex read")
    .replace(/^number of tests found$/, "Number of tests read from the report")
    .replace(/^urgent flag$/, "Urgent warning shown")
    .replace(/^asks for$/, "Asks the user for")
    .replace(/^chat refused$/, "Message refused")
    .replace(/^refusal cites the safety rules file$/, "Refusal points to the lab's safety rule");
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
      <header className="sticky top-0 z-40 border-b border-ink/15 bg-cream/90">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="font-display text-[1.7rem] leading-none font-semibold tracking-tight text-ink">
            Samjho
          </Link>
          <Link href="/" className="rounded-full border border-ink/15 bg-white px-3.5 py-2 text-sm font-medium text-ink/85 transition hover:border-brand hover:bg-brand/10">
            Back to the app
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
        <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">How we tested Samjho</p>
        <h1 className="font-display mt-1 text-5xl leading-none font-semibold tracking-tight text-ink sm:text-6xl">Does it give the right answer?</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink/85">
          Every time you open this page, it runs {run ? run.total : "60"} reports through the same rules the app uses, and compares each answer with the answer it should give. It is a live exam, marked by code, on the real server.
        </p>

        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Feed it a report", "One of the organisers' 14, or a tricky one we wrote: a value on a danger limit, a missing age, a messy layout."],
            ["Samjho labels it", "Normal, low, high, urgent, asks for details, or cannot be classified. Exactly what you would see in the app."],
            ["Mark the answer", "Green if Samjho matched the correct answer on every point. Red, with what went wrong, if it did not."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-2xl border border-ink/15 bg-white p-4">
              <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xl font-semibold text-white">{i + 1}</span>
              <span>
                <span className="block font-semibold text-ink">{t}</span>
                <span className="block text-sm leading-snug text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">No AI is involved in these answers, so they come out the same every time. Tap any row to see each point it was marked on.</p>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className={`card rounded-3xl p-5 ${run ? (allPass ? "border-forest/40" : "border-urgent/50") : ""}`}>
            <p className="text-sm text-muted">Reports answered correctly</p>
            <p className="mt-1 text-4xl font-bold text-ink tabular-nums">{run ? `${run.passed} / ${run.total}` : loading ? "..." : "n/a"}</p>
            {run && <p className={`mt-1 text-sm font-medium ${allPass ? "text-forest" : "text-urgent"}`}>{allPass ? "Every answer correct" : `${run.failed} wrong`}</p>}
          </div>
          <div className="card rounded-3xl p-5">
            <p className="text-sm text-muted">Time to check all of them</p>
            <p className="mt-1 text-4xl font-bold text-ink tabular-nums">{run ? `${run.ms} ms` : loading ? "..." : "n/a"}</p>
            {run && <p className="mt-1 text-sm text-muted">Ran at {new Date(run.ranAt).toLocaleTimeString()}</p>}
          </div>
          <div className="card rounded-3xl p-5">
            <p className="text-sm text-muted">AI writer (only words, never verdicts)</p>
            <p className="font-display mt-1 truncate text-xl font-semibold text-ink">{health ? (health.llm.reachable ? "Reachable" : "Unavailable") : loading ? "..." : "n/a"}</p>
            {health && (
              <p className="mt-1 text-sm leading-snug text-muted">
                {health.llm.model ?? "no model set"}
                <br />
                fallback {health.llm.fallbackModel ?? "none"}
              </p>
            )}
          </div>
        </div>

        {health && (
          <p className="mt-4 hidden text-sm leading-relaxed text-muted">
            Knowledge base built from {health.knowledgeBase.files} files ({health.knowledgeBase.boilerplateRemovedPct}% boilerplate removed): {health.knowledgeBase.ranges} range rows, {health.knowledgeBase.aliases} aliases,{" "}
            {health.knowledgeBase.urgentThresholds} urgent thresholds, {health.knowledgeBase.rules} cited rules. Since this server instance started: {health.llm.stats.calls} model calls, {health.llm.stats.cacheHits} cache hits,{" "}
            {health.llm.stats.retries} retries, {health.llm.stats.fallbacks} fallbacks, {health.llm.stats.rateLimited} rate-limit responses.
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={load} disabled={loading} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50">
            {loading ? "Running..." : "Run again"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-urgent">
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
                  <div>
                    <h2 className="font-display text-3xl font-semibold text-ink">{GROUPS[group]?.title ?? group}</h2>
                    {GROUPS[group] && <p className="mt-0.5 text-sm text-muted">{GROUPS[group].about}</p>}
                  </div>
                  <p className={`text-sm font-medium tabular-nums ${ok === rows.length ? "text-forest" : "text-urgent"}`}>
                    {ok} of {rows.length} correct
                  </p>
                </div>
                <ul className="mt-3 grid gap-2">
                  {rows.map((r) => (
                    <li key={r.id} className={`card overflow-hidden rounded-2xl ${r.pass ? "" : "border-urgent/50"}`}>
                      <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${r.pass ? "bg-forest text-white" : "bg-urgent text-white"}`}>{r.pass ? "✓ Correct" : "✗ Wrong"}</span>
                        <span className="min-w-0 flex-1 text-[0.95rem] text-ink/85">{r.title.replace(/->/g, "→")}</span>
                        <span className="hidden shrink-0 text-xs text-muted tabular-nums sm:inline">{r.checks.filter((c) => c.pass).length} of {r.checks.length} points</span>
                      </button>
                      <AnimatePresence initial={false}>
                        {open === r.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="overflow-x-auto border-t border-ink/15 bg-cream-deep/60 px-4 py-3">
                              <table className="w-full text-left text-sm">
                                <thead>
                                  <tr className="text-xs tracking-wide text-muted uppercase">
                                    <th className="py-1 pr-3 font-semibold" />
                                    <th className="py-1 pr-3 font-semibold">What we checked</th>
                                    <th className="py-1 pr-3 font-semibold">Correct answer</th>
                                    <th className="py-1 font-semibold">Samjho said</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.checks.map((c, i) => (
                                    <tr key={i} className="border-t border-ink/10 align-top">
                                      <td className={`py-1.5 pr-3 font-bold ${c.pass ? "text-forest" : "text-urgent"}`}>{c.pass ? "✓" : "✗"}</td>
                                      <td className="py-1.5 pr-3 text-ink">{plainLabel(c.label)}</td>
                                      <td className="py-1.5 pr-3 text-ink">{plain(c.want)}</td>
                                      <td className={`py-1.5 ${c.pass ? "text-ink" : "font-semibold text-urgent"}`}>{plain(c.got)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
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

      <footer className="border-t border-ink/15 bg-cream-deep/60 px-5 py-6 text-center text-sm text-muted">
        This page runs 60 of the 267 automated tests. Run all of them with <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-ink">npm test</code>.
      </footer>
    </div>
  );
}
