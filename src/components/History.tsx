"use client";

import { useEffect, useMemo, useState } from "react";
import type { Patient, Status, TestResult } from "@/lib/types";
import { STATUS } from "./status";

/**
 * Profiles and personal history.
 * Each analysed report is saved in this browser only (localStorage) under a
 * profile: the patient's MRN or name from the report, or a name the user types
 * when the report has neither. When the same person brings a newer report we
 * show what changed. Nothing is sent to a server, and the chat is still locked
 * to the one report that is open.
 */

const STORE_KEY = "samjho.history.v1";
const CHANGED = "samjho-history-changed";

export interface Visit {
  date: string;
  results: Array<{ test: string; value: number | string; unit: string | null; status: Status }>;
}

export type Store = Record<string, { name: string | null; visits: Visit[] }>;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function patientKey(p: Patient): string | null {
  const raw = p.mrn ?? p.name;
  return raw ? norm(raw) : null;
}

export function readStore(): Store {
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* storage full or blocked: history is a nice-to-have */
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
  const [typedName, setTypedName] = useState("");
  const [chosenName, setChosenName] = useState<string | null>(null);
  const key = patientKey(patient) ?? (chosenName ? norm(chosenName) : null);
  const displayName = patient.name ?? chosenName;
  const date = useMemo(() => reportDate(reportText), [reportText]);
  const [visits, setVisits] = useState<Visit[]>([]);

  // Save this report (once it is fully labelled) and load the person's earlier ones.
  useEffect(() => {
    if (!key) return;
    const store = readStore();
    const entry = store[key] ?? { name: displayName, visits: [] };
    if (complete && results.length > 0) {
      const visit = toVisit(date, results);
      entry.name = entry.name ?? displayName;
      entry.visits = [...entry.visits.filter((v) => v.date !== date), visit].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
      store[key] = entry;
      writeStore(store);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after mount
    setVisits(entry.visits);
  }, [key, date, results, complete, displayName]);

  // The report names nobody: ask whose it is, so it can go in a profile.
  if (!key) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typedName.trim().length >= 2) setChosenName(typedName.trim());
        }}
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-ink/15 bg-white p-5"
      >
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          Whose report is this? Name it to keep a history for them on this device.
          <input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value.slice(0, 40))}
            placeholder="e.g. Ammi, Bilal, me"
            className="w-64 max-w-full rounded-xl border border-ink/25 bg-cream/50 px-3.5 py-2.5 text-base font-normal text-ink placeholder:text-muted focus:border-brand focus:outline-none"
          />
        </label>
        <button type="submit" disabled={typedName.trim().length < 2} className="rounded-full bg-ink px-5 py-2.5 text-base font-semibold text-white transition hover:bg-ink/85 disabled:opacity-40">
          Save profile
        </button>
      </form>
    );
  }

  const earlier = visits.filter((v) => v.date < date);
  const previous = earlier[earlier.length - 1];
  const who = displayName?.split(" ")[0] ?? "This patient";

  const forget = () => {
    const store = readStore();
    delete store[key];
    writeStore(store);
    setVisits([]);
  };

  if (!previous) {
    return (
      <p className="text-sm text-muted">
        Saved to {who}&apos;s profile on this device ({fmt(date)}). Bring the next report and Samjho will show what changed.{" "}
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
        History is kept in this browser only, under this person&apos;s own profile. It is never sent anywhere and never mixed with another patient. A change in a number is not a diagnosis: ask your doctor what it means.
      </p>
    </section>
  );
}

/** "People on this device": every saved profile with its report timeline. */
export function Profiles() {
  const [store, setStore] = useState<Store>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const load = () => setStore(readStore());
    load();
    window.addEventListener(CHANGED, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CHANGED, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const people = Object.entries(store).filter(([, p]) => p.visits.length > 0);
  if (people.length === 0) return null;

  const remove = (key: string) => {
    const next = readStore();
    delete next[key];
    writeStore(next);
    setOpen(null);
  };

  return (
    <section className="border-t border-ink/10" aria-label="Profiles on this device">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">On this device only</p>
        <h2 className="font-display mt-2 text-5xl leading-none font-semibold text-ink">Your people</h2>
        <p className="mt-2 max-w-xl text-lg text-muted">Every report you explain is filed under the person it belongs to. Open a profile to see their reports over time.</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {people.map(([key, p]) => {
            const last = p.visits[p.visits.length - 1];
            const flagged = last.results.filter((r) => ["low", "high", "abnormal", "urgent"].includes(r.status)).length;
            const urgent = last.results.some((r) => r.status === "urgent");
            const name = p.name ?? key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setOpen(open === key ? null : key)}
                aria-expanded={open === key}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${open === key ? "border-ink bg-ink text-white" : "border-ink/20 bg-white text-ink hover:border-brand"}`}
              >
                <span className={`font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none font-semibold ${urgent ? "bg-urgent text-white" : "bg-brand text-white"}`}>
                  {name.trim()[0]?.toUpperCase()}
                </span>
                <span>
                  <span className="block font-semibold">{name}</span>
                  <span className={`block text-sm ${open === key ? "text-white/75" : "text-muted"}`}>
                    {p.visits.length} {p.visits.length === 1 ? "report" : "reports"} · last {fmt(last.date)}
                    {flagged > 0 ? ` · ${flagged} to discuss` : " · all normal"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {open && store[open] && (
          <div className="mt-5 rounded-3xl border border-ink/15 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-3xl font-semibold text-ink">{store[open].name ?? open}</h3>
              <button type="button" onClick={() => remove(open)} className="text-sm font-semibold text-muted underline underline-offset-2 hover:text-urgent">
                Delete this profile
              </button>
            </div>
            <ol className="mt-4 grid gap-4">
              {[...store[open].visits].reverse().map((v) => (
                <li key={v.date} className="border-l-2 border-brand pl-4">
                  <p className="font-semibold text-ink">{fmt(v.date)}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-2">
                    {v.results.map((r) => (
                      <li key={r.test} className={`rounded-full border px-2.5 py-1 text-sm ${STATUS[r.status].pill}`}>
                        {r.test}: {String(r.value)} {r.unit ?? ""} · {STATUS[r.status].label}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
