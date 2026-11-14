"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState } from "react";
import type { TestResult } from "@/lib/types";
import { STATUS, STEP_LABEL } from "./status";
import TestTube from "./TestTube";

function rangeText(r: TestResult): string | null {
  const range = r.rangeUsed;
  if (!range) return null;
  const who = `${range.sex === "all" ? "all sexes" : range.sex}, age ${range.ageMin} to ${range.ageMax}`;
  if (range.qualitative) return `Expected: ${range.qualitative} (${who})`;
  const unit = range.unit ? ` ${range.unit}` : "";
  if (range.low !== null && range.high !== null) return `Normal range: ${range.low} to ${range.high}${unit} (${who})`;
  if (range.high !== null) return `Normal: up to ${range.high}${unit} (${who})`;
  return `Normal: ${range.low}${unit} or more (${who})`;
}

function verdictLine(r: TestResult): string {
  switch (r.status) {
    case "normal":
      return "This value is inside the lab's normal range.";
    case "low":
      return "This value is below the lab's normal range.";
    case "high":
      return "This value is above the lab's normal range.";
    case "abnormal":
      return "This is not the result the lab expects.";
    case "urgent":
      return r.warning ?? "This value reached the lab's urgent limit. See a doctor today.";
    case "needs_info":
      return r.question ?? "More information is needed to pick the right range.";
    default:
      return "This cannot be classified from the files. The lab's reference sheets do not cover it.";
  }
}

export default function ResultCard({ result, index, use3D }: { result: TestResult; index: number; use3D: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS[result.status];
  const panelId = useId();
  const renamed = result.canonicalName !== result.originalName;
  const range = rangeText(result);

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.07, 0.5), ease: [0.22, 1, 0.36, 1] }}
      className={`glass relative overflow-hidden rounded-3xl border ${meta.ring}`}
    >
      <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: meta.color }} aria-hidden="true" />

      <div className="relative flex gap-4 p-5 sm:gap-5 sm:p-6">
        <TestTube position={result.position} color={meta.color} urgent={result.status === "urgent"} use3D={use3D} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-lg leading-tight font-semibold text-white sm:text-xl">{result.canonicalName}</h3>
              {renamed && (
                <p className="mt-1 text-sm text-slate-300">
                  Written on the report as <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.8rem] text-white">{result.originalName}</span>
                </p>
              )}
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase ${meta.pill}`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
              {meta.label}
              {result.direction && result.status === "urgent" ? ` (${result.direction})` : ""}
            </span>
          </div>

          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-display text-3xl font-semibold text-white tabular-nums sm:text-4xl">{result.rawValue}</span>
            {result.unit && <span className="text-base text-slate-300">{result.unit}</span>}
            {result.conversion && (
              <span className="rounded-full border border-teal-300/40 bg-teal-400/10 px-2.5 py-0.5 text-sm text-teal-100">
                = {result.conversion.toValue} {result.conversion.toUnit}
              </span>
            )}
          </p>

          <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-200">{verdictLine(result)}</p>
          {range && <p className="mt-1 text-sm text-slate-300">{range}</p>}
          {result.rangeUsed && (
            <p className="mt-1 text-xs text-slate-400">
              Source: <span className="font-mono text-slate-300">{result.rangeUsed.source.file}</span>, line {result.rangeUsed.source.line}
            </p>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-teal-100 transition hover:border-teal-300/50 hover:bg-teal-400/10"
          >
            <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            How we got this
            <span className="text-slate-400">({result.trace.length} steps)</span>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="trace"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ol className="relative border-t border-white/10 bg-black/20 px-5 py-5 sm:px-6">
              {result.trace.map((step, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i }}
                  className="relative flex gap-3 pb-4 last:pb-0"
                >
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-teal-300/50 bg-teal-400/10 text-[0.7rem] font-semibold text-teal-100">
                      {i + 1}
                    </span>
                    {i < result.trace.length - 1 && <span className="mt-1 w-px flex-1 bg-white/15" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="text-xs font-semibold tracking-wide text-teal-200 uppercase">{STEP_LABEL[step.step] ?? step.step}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-200">{step.detail}</p>
                    {step.source && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[0.72rem] text-slate-200">
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <path d="M4 1.5h5l3 3v10H4z M9 1.5v3h3" strokeLinejoin="round" />
                        </svg>
                        {step.source.file}:{step.source.line}
                      </p>
                    )}
                  </div>
                </motion.li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
