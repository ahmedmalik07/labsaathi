"use client";

import { useEffect, useMemo, useState } from "react";
import type { Patient, Status, TestResult } from "@/lib/types";
import { STATUS } from "./status";

/**
 * Personal history. Each analysed report is saved in this browser only
 * (localStorage), under the patient's own MRN or name. When the same patient
 * brings a newer report, we show what changed. Nothing is sent to a server and
 * one patient's history is never shown next to another patient's report.
 */

const STORE_KEY = "samjho.history.v1";

interface Visit {
  date: string;
  results: Array<{ test: string; value: number | string; unit: string | null; status: Status }>;
}

type Store = Record<string, { name: string | null; visits: Visit[] }>;

function patientKey(p: Patient): string | null {
  const raw = p.mrn ?? p.name;
  return raw ? raw.toLowerCase().replace(/\s+/g, " ").trim() : null;
}

function readStore(): Store {
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

/** The report's own date if it prints one, otherwise today. */
export function reportDate(text: string): string {
  const m = text.match(/date[^:\n]{0,30}:\s*\**\s*(\d{4}-\d{2}-\d{2})/i);
  return m ? m[1] : new Date().toISOString().slice(0, 10);
}

function toVisit(date: string, results: TestResult[]): Visit {
  return {
    date,
    results: results
      .filter((r) => r.status !== "needs_info")
      .map((r) => ({ test: r.canonicalName, value: r.convertedValue ?? r.value, unit: r.convertedUnit ?? r.unit, status: r.status })),
  };
}

function Spark({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [4 + (i * 72) / (points.length - 1), 24 - ((p - min) / span) * 20] as const);
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20 shrink-0" aria-hidden="true">
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#16130f" strokeOpacity="0.35" strokeWidth="1.5" />
      {xy.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 3.2 : 2} fill={i === xy.length - 1 ? color : "#16130f"} fillOpacity={i === xy.length - 1 ? 1 : 0.45} />
      ))}
    </svg>
  );
}

const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function History({ patient, results, reportText, complete }: { patient: Patient; results: TestResult[]; reportText: string; complete: boolean }) {
  const key = patientKey(patient);
  const date = useMemo(() => reportDate(reportText), [reportText]);
  const [visits, setVisits] = useState<Visit[]>([]);

  // Save this report (once it is fully labelled) and load the patient's earlier ones.
  useEffect(() => {
    if (!key) return;
    const store = readStore();
    const entry = store[key] ?? { name: patient.name, visits: [] };
    if (complete && results.length > 0) {
      const visit = toVisit(date, results);
      entry.visits = [...entry.visits.filter((v) => v.date !== date), visit].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
      store[key] = entry;
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
      } catch {
        /* storage full or blocked: history is a nice-to-have */
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after mount
    setVisits(entry.visits);
  }, [key, date, results, complete, patient.name]);

  if (!key) return null;

  const earlier = visits.filter((v) => v.date < date);
  const previous = earlier[earlier.length - 1];
  const who = patient.name?.split(" ")[0] ?? "This patient";

  const forget = () => {
    const store = readStore();
    delete store[key];
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    setVisits([]);
  };

  if (!previous) {
    return (
      <p className="text-sm text-muted">
        Saved on this device as {who}&apos;s first report ({fmt(date)}). Bring the next one and Samjho will show what changed.{" "}
        <button type="button" onClick={forget} className="font-semibold text-ink underline underline-offset-2 hover:text-brand">
          Don&apos;t keep it
        </button>
      </p>
    );
  }

  const rows = results
    .filter((r) => r.status !== "needs_info")
    .map((r) => {
      const now = r.convertedValue ?? r.value;
      const series = visits.filter((v) => v.date <= date).map((v) => v.results.find((x) => x.test === r.canonicalName)).filter(Boolean) as Visit["results"];
      const before = previous.results.find((x) => x.test === r.canonicalName);
      return { r, now, before, numbers: series.map((s) => s.value).filter((v): v is number => typeof v === "number") };
    })
    .filter((row) => row.before);

  if (rows.length === 0) return null;

  return (
    <section className="rounded-3xl border border-ink/15 bg-white p-5 sm:p-6" aria-label="History">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">{who}&apos;s history</p>
          <h3 className="font-display mt-1 text-3xl leading-tight font-semibold text-ink">Since the last report on {fmt(previous.date)}</h3>
        </div>
        <button type="button" onClick={forget} className="text-sm font-semibold text-muted underline underline-offset-2 hover:text-brand">
          Forget this history
        </button>
      </div>

      <ul className="mt-4 divide-y divide-ink/10">
        {rows.map(({ r, now, before, numbers }) => {
          const numeric = typeof now === "number" && typeof before!.value === "number";
          const diff = numeric ? Math.round(((now as number) - (before!.value as number)) * 100) / 100 : 0;
          const moved = before!.status !== r.status;
          const better = moved && r.status === "normal";
          const worse = moved && (r.status === "urgent" || before!.status === "normal");
          return (
            <li key={r.canonicalName} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="w-44 shrink-0 font-semibold text-ink">{r.canonicalName}</span>
              <span className="text-muted tabular-nums">
                {String(before!.value)} {before!.unit ?? ""}
              </span>
              <span aria-hidden="true" className="text-muted">
                →
              </span>
              <span className="font-semibold text-ink tabular-nums">
                {String(now)} {r.convertedUnit ?? r.unit ?? ""}
              </span>
              {numeric && diff !== 0 && (
                <span className="text-sm text-muted tabular-nums">
                  ({diff > 0 ? "up" : "down"} {Math.abs(diff)})
                </span>
              )}
              <Spark points={numbers} color={STATUS[r.status].color} />
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${better ? "bg-forest text-white" : worse ? "bg-urgent text-white" : "bg-cream-deep text-ink"}`}>
                {moved ? `${STATUS[before!.status].label} → ${STATUS[r.status].label}` : `Still ${STATUS[r.status].label.toLowerCase()}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted">
        History is kept in this browser only, under this patient&apos;s own MRN. It is never sent anywhere and never mixed with another patient. A change in a number is not a diagnosis: ask your doctor what it means.
      </p>
    </section>
  );
}
