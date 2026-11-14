"use client";

/**
 * More tools for the Tools page. Every verdict shown here comes from the same
 * rules engine as the main app (POST /api/analyze with explain:false).
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeText, download, STATUS_WORD } from "@/lib/client";
import type { AnalyzeResponse } from "@/lib/pipeline";
import type { RangeRow, ReferenceTables, TestResult } from "@/lib/types";
import ResultCard from "./ResultCard";
import { STATUS } from "./status";

const field = "w-full rounded-xl border border-ink/25 bg-white px-3.5 py-2.5 text-base text-ink focus:border-brand focus:outline-none";
const btn = "rounded-full bg-brand px-5 py-2.5 text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-45";
const ghost = "rounded-full border border-ink/25 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-45";

function Pill({ status }: { status: TestResult["status"] }) {
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS[status].pill}`}>{STATUS_WORD[status]}</span>;
}

async function readFiles(list: FileList | null): Promise<Array<{ name: string; text: string }>> {
  if (!list) return [];
  const files = [...list].filter((f) => f.size < 400_000 && /\.(md|txt|markdown)$/i.test(f.name)).slice(0, 25);
  return Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
}

/* ------------------------------------------------------------ 1. what if */

export function WhatIf({ tables, use3D }: { tables: ReferenceTables; use3D: boolean }) {
  const numeric = useMemo(() => tables.ranges.filter((r) => r.low !== null && r.high !== null), [tables]);
  const tests = useMemo(() => [...new Set(numeric.map((r) => r.test))], [numeric]);
  const [test, setTest] = useState(tests[0] ?? "Hemoglobin");
  const [sex, setSex] = useState<"female" | "male">("female");
  const row: RangeRow | undefined = numeric.find((r) => r.test === test && (r.sex === "all" || r.sex === sex));
  const lo = row?.low ?? 0;
  const hi = row?.high ?? 100;
  const span = hi - lo;
  // The slider always reaches past the lab's danger limits, so you can watch a result turn urgent.
  const urgentLow = tables.urgent.find((u) => u.test === test && u.direction === "low")?.threshold;
  const urgentHigh = tables.urgent.find((u) => u.test === test && u.direction === "high")?.threshold;
  const min = Math.max(0, Math.min(lo - span * 1.2, urgentLow !== undefined ? urgentLow * 0.8 : Infinity));
  const max = Math.max(hi + span * 1.4, urgentHigh !== undefined ? urgentHigh * 1.15 : 0);
  const step = span >= 1000 ? 1000 : span >= 50 ? 1 : 0.1;
  const [value, setValue] = useState<number | null>(null);
  const v = value ?? Math.round(((lo + hi) / 2) / step) * step;
  const [out, setOut] = useState<AnalyzeResponse | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!row) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const shown = step < 1 ? v.toFixed(1) : String(Math.round(v));
      const report = `Patient Name: What if\nAge: 40\nSex: ${sex}\n- ${test}: ${shown} ${row.unit ?? ""}`;
      try {
        setOut(await analyzeText(report));
      } catch {
        /* keep the last answer */
      }
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [v, test, sex, row, step]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="grid content-start gap-4">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Test
          <select value={test} onChange={(e) => { setTest(e.target.value); setValue(null); }} className={field}>
            {tests.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-1.5 rounded-full bg-white p-1">
          {(["female", "male"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSex(s)} className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${sex === s ? "bg-ink text-white" : "text-ink"}`}>
              {s}, age 40
            </button>
          ))}
        </div>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Drag the value
          <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-[#e8501f]" />
          <span className="font-display text-5xl text-ink tabular-nums">
            {step < 1 ? v.toFixed(1) : Math.round(v).toLocaleString()} <span className="font-sans text-lg text-muted">{row?.unit}</span>
          </span>
        </label>
        <p className="text-sm text-muted">
          Lab&apos;s range: {lo.toLocaleString()} to {hi.toLocaleString()} {row?.unit}. Watch the label change as you cross a limit, and the red banner if you reach a danger limit.
        </p>
      </div>
      <div className="min-h-[14rem]">
        {out?.results[0] && <ResultCard key={test + sex} result={out.results[0]} index={0} use3D={use3D} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 2. compare */

export function Compare() {
  const [a, setA] = useState<{ name: string; text: string } | null>(null);
  const [b, setB] = useState<{ name: string; text: string } | null>(null);
  const [rows, setRows] = useState<Array<{ test: string; a?: TestResult; b?: TestResult }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDemo() {
    const [x, y] = await Promise.all(["demo_1_ayesha_full_checkup.md", "demo_1b_ayesha_followup.md"].map(async (f) => ({ name: f, text: await (await fetch(`/demo/${f}`)).text() })));
    setA(x);
    setB(y);
  }

  async function run() {
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    try {
      const [ra, rb] = await Promise.all([analyzeText(a.text), analyzeText(b.text)]);
      const pa = ra.patient.mrn ?? ra.patient.name;
      const pb = rb.patient.mrn ?? rb.patient.name;
      if (pa && pb && pa !== pb) throw new Error(`These are two different people (${ra.patient.name ?? pa} and ${rb.patient.name ?? pb}). Samjho only compares reports of the same person.`);
      const names = [...new Set([...ra.results, ...rb.results].map((r) => r.canonicalName))];
      setRows(names.map((n) => ({ test: n, a: ra.results.find((r) => r.canonicalName === n), b: rb.results.find((r) => r.canonicalName === n) })));
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : "Those reports could not be compared.");
    } finally {
      setBusy(false);
    }
  }

  const slot = (label: string, val: { name: string; text: string } | null, set: (v: { name: string; text: string } | null) => void) => (
    <label className="grid cursor-pointer gap-1 rounded-2xl border-2 border-dashed border-ink/25 bg-white p-4 text-center transition hover:border-brand">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="truncate text-sm text-muted">{val ? val.name : "Choose a .md or .txt report"}</span>
      <input type="file" accept=".md,.txt,.markdown,text/plain" className="sr-only" onChange={async (e) => set((await readFiles(e.target.files))[0] ?? null)} />
    </label>
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {slot("Older report", a, setA)}
        {slot("Newer report", b, setB)}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={run} disabled={!a || !b || busy} className={btn}>
          {busy ? "Comparing..." : "Compare"}
        </motion.button>
        <button type="button" onClick={loadDemo} className={ghost}>
          Try with Ayesha&apos;s two reports
        </button>
      </div>
      {error && <p className="mt-3 rounded-xl bg-urgent/10 px-4 py-2.5 text-urgent">{error}</p>}
      {rows && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-ink/15 bg-white">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-cream-deep/60 text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Test</th>
                <th className="px-4 py-2.5">Before</th>
                <th className="px-4 py-2.5">After</th>
                <th className="px-4 py-2.5">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const va = typeof r.a?.convertedValue === "number" ? r.a.convertedValue : typeof r.a?.value === "number" ? r.a.value : null;
                const vb = typeof r.b?.convertedValue === "number" ? r.b.convertedValue : typeof r.b?.value === "number" ? r.b.value : null;
                const d = va !== null && vb !== null ? Math.round((vb - va) * 100) / 100 : null;
                return (
                  <motion.tr key={r.test} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="border-t border-ink/10">
                    <td className="px-4 py-2.5 font-semibold text-ink">{r.test}</td>
                    <td className="px-4 py-2.5">{r.a ? <>{r.a.rawValue} <Pill status={r.a.status} /></> : <span className="text-muted">not tested</span>}</td>
                    <td className="px-4 py-2.5">{r.b ? <>{r.b.rawValue} <Pill status={r.b.status} /></> : <span className="text-muted">not tested</span>}</td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">
                      {d === null || d === 0 ? <span className="text-muted">no change</span> : <span>{d > 0 ? "▲" : "▼"} {Math.abs(d).toLocaleString()}</span>}
                      {r.a && r.b && r.a.status !== r.b.status && <span className="ml-2 text-xs text-brand">{STATUS_WORD[r.a.status]} → {STATUS_WORD[r.b.status]}</span>}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm text-muted">Nothing is saved. Both reports must belong to the same person (same MRN or name), so two patients are never mixed.</p>
    </div>
  );
}

/* ------------------------------------------------------------ 3. x-ray */

export function XRay() {
  const [text, setText] = useState("");
  const [out, setOut] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setOut(await analyzeText(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be read.");
    } finally {
      setBusy(false);
    }
  }

  const layoutOf = (r: TestResult) => r.trace[0]?.detail.match(/layout: ([^,)]+)/)?.[1] ?? "?";
  const lineOf = (r: TestResult) => r.trace[0]?.detail.match(/line (\d+)/)?.[1] ?? "?";
  const p = out?.patient;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} placeholder="Paste any lab report. Samjho shows exactly what it could and could not read." className={`${field} font-mono text-sm`} />
        <div className="mt-3 flex flex-wrap gap-3">
          <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={run} disabled={busy || !text.trim()} className={btn}>
            {busy ? "Scanning..." : "X-ray it"}
          </motion.button>
          <button type="button" onClick={async () => setText(await (await fetch("/demo/demo_3_sana_messy_layout.md")).text())} className={ghost}>
            Use a messy example
          </button>
        </div>
        {error && <p className="mt-3 text-urgent">{error}</p>}
      </div>
      <div>
        {out && p ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
            <div className="rounded-2xl border border-ink/15 bg-white p-4">
              <p className="text-xs font-bold tracking-[0.16em] text-muted uppercase">Noise removed</p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-cream-deep">
                <motion.div className="h-full bg-brand" initial={{ width: 0 }} animate={{ width: `${out.meta.cleaning.removedPct}%` }} transition={{ duration: 0.8 }} />
              </div>
              <p className="mt-1 text-sm text-ink">{out.meta.cleaning.removedPct}% of the text was boilerplate and was skipped.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["Name", p.name],
                  ["Age", p.age],
                  ["Sex", p.sex],
                  ["MRN", p.mrn],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className={`rounded-xl border p-3 ${v === null ? "border-info bg-info/10" : "border-ink/15 bg-white"}`}>
                  <p className="text-xs font-bold text-muted uppercase">{k}</p>
                  <p className={`truncate font-semibold ${v === null ? "text-info" : "text-ink"}`}>{v === null ? "missing" : String(v)}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-ink/15 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-cream-deep/60 text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-3 py-2">Written as</th>
                    <th className="px-3 py-2">Read as</th>
                    <th className="px-3 py-2">Layout, line</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {out.results.map((r, i) => (
                    <tr key={i} className="border-t border-ink/10">
                      <td className="px-3 py-2 font-mono text-ink">{r.originalName}</td>
                      <td className="px-3 py-2 text-ink">
                        {r.matchedBy === "none" ? <span className="text-muted">not in the lab&apos;s files</span> : r.canonicalName}
                        {r.matchedBy !== "none" && r.matchedBy !== "exact" && <span className="block text-xs text-muted">by {r.matchedBy}</span>}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {layoutOf(r)}, {lineOf(r)}
                      </td>
                      <td className="px-3 py-2">
                        <Pill status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {out.results.length === 0 && <p className="text-ink">No test results were found. Check the text has lines like &quot;Hemoglobin: 13.5 g/dL&quot;.</p>}
          </motion.div>
        ) : (
          <div className="flex h-full min-h-[12rem] items-center justify-center rounded-3xl border-2 border-dashed border-ink/20 p-6 text-center text-muted">What Samjho read appears here: the noise it skipped, the details it found, and each test line by line.</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 4. batch */

interface BatchRow {
  file: string;
  name: string;
  tests: number;
  urgent: string;
  attention: string;
  asks: string;
  unknown: string;
  error?: string;
}

export function Batch() {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);

  async function run(list: Array<{ name: string; text: string }>) {
    setRows([]);
    setDone(0);
    setTotal(list.length);
    for (const f of list) {
      let row: BatchRow;
      try {
        const out = await analyzeText(f.text);
        const pick = (s: TestResult["status"][]) => out.results.filter((r) => s.includes(r.status)).map((r) => r.canonicalName).join("; ");
        row = { file: f.name, name: out.patient.name ?? "", tests: out.results.length, urgent: pick(["urgent"]), attention: pick(["low", "high", "abnormal"]), asks: out.needsInfo.map((n) => n.field).join(" and "), unknown: pick(["unclassified"]) };
      } catch (e) {
        row = { file: f.name, name: "", tests: 0, urgent: "", attention: "", asks: "", unknown: "", error: e instanceof Error ? e.message : "failed" };
      }
      setRows((r) => [...r, row]);
      setDone((d) => d + 1);
    }
  }

  async function samples() {
    const list = await (await fetch("/api/samples")).json();
    const files = await Promise.all(
      (list.samples as Array<{ id: string; file: string }>).map(async (s) => ({ name: s.file, text: (await (await fetch(`/api/samples/${s.id}`)).json()).reportText as string })),
    );
    run(files);
  }

  function csv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["file", "patient", "tests", "urgent", "needs attention", "asks for", "cannot classify", "error"];
    const body = rows.map((r) => [r.file, r.name, r.tests, r.urgent, r.attention, r.asks, r.unknown, r.error ?? ""].map(esc).join(","));
    download("samjho-batch.csv", new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" }));
  }

  return (
    <div>
      <p className="max-w-2xl text-ink">For a clinic or a lab: drop in many reports at once and get one table, urgent ones first. Nothing is stored.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className={`${btn} cursor-pointer`}>
          Choose report files
          <input type="file" multiple accept=".md,.txt,.markdown,text/plain" className="sr-only" onChange={async (e) => run(await readFiles(e.target.files))} />
        </label>
        <button type="button" onClick={samples} className={ghost}>
          Run all 14 samples
        </button>
        {rows.length > 0 && done === total && (
          <button type="button" onClick={csv} className={ghost}>
            Download CSV
          </button>
        )}
      </div>
      {total > 0 && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-cream-deep">
            <motion.div className="h-full bg-forest" animate={{ width: `${(done / total) * 100}%` }} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {done} of {total} read
          </p>
        </div>
      )}
      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/15 bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-cream-deep/60 text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-3 py-2">Patient</th>
                <th className="px-3 py-2">Tests</th>
                <th className="px-3 py-2">Urgent</th>
                <th className="px-3 py-2">To discuss</th>
                <th className="px-3 py-2">Asks for</th>
                <th className="px-3 py-2">Can&apos;t say</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {[...rows]
                  .sort((x, y) => Number(!!y.urgent) - Number(!!x.urgent))
                  .map((r) => (
                    <motion.tr key={r.file} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`border-t border-ink/10 ${r.urgent ? "bg-urgent/5" : ""}`}>
                      <td className="px-3 py-2">
                        <span className="block font-semibold text-ink">{r.name || "unnamed"}</span>
                        <span className="block font-mono text-xs text-muted">{r.file}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.error ? <span className="text-urgent">{r.error}</span> : r.tests}</td>
                      <td className="px-3 py-2 font-semibold text-urgent">{r.urgent}</td>
                      <td className="px-3 py-2 text-ink">{r.attention}</td>
                      <td className="px-3 py-2 text-info">{r.asks}</td>
                      <td className="px-3 py-2 text-muted">{r.unknown}</td>
                    </motion.tr>
                  ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ 5. reminder */

export function ReminderMaker({ tests = [] }: { tests?: string[] }) {
  const [what, setWhat] = useState(tests[0] ? `Repeat ${tests.slice(0, 3).join(", ")} test` : "Repeat my blood test");
  const [date, setDate] = useState(() => new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10));
  const [made, setMade] = useState(false);

  function make() {
    const d = date.replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Samjho//Lab reminder//EN",
      "BEGIN:VEVENT",
      `UID:${stamp}-${Math.random().toString(36).slice(2)}@samjho`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${what.replace(/[,;\\]/g, " ")}`,
      "DESCRIPTION:Reminder from Samjho. Take your last report and your doctor's questions with you.",
      "BEGIN:VALARM",
      "TRIGGER:-PT9H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Lab test tomorrow",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    download("samjho-reminder.ics", new Blob([ics], { type: "text/calendar" }));
    setMade(true);
  }

  return (
    <div className="grid max-w-xl gap-3">
      <label className="grid gap-1 text-sm font-semibold text-ink">
        What
        <input value={what} onChange={(e) => setWhat(e.target.value.slice(0, 80))} className={field} />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        On (use the date your doctor gives you)
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </label>
      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={make} className={btn}>
        Add to my calendar
      </motion.button>
      {made && <p className="text-sm text-forest">Downloaded. Open the file and it goes into Google Calendar, Outlook or your phone&apos;s calendar.</p>}
    </div>
  );
}

/* ------------------------------------------------------------ 6. urdu words */

const WORDS: Array<[string, string, string]> = [
  ["Normal range", "Aam had", "The values most healthy people have, according to the lab."],
  ["High / Low", "Zyada / Kam", "Above or below the lab's range."],
  ["Urgent", "Fori", "Reached a danger limit. See a doctor today."],
  ["Hemoglobin", "Khoon ka oxygen wala hissa", "Carries oxygen in the blood."],
  ["Blood sugar", "Khoon mein cheeni", "Sugar in the blood."],
  ["Fasting", "Khali pait", "Not eating for some hours before the test."],
  ["Platelets", "Khoon jamaane wale zarre", "Help blood clot after a cut."],
  ["White blood cells", "Safaid khaliye", "Help fight germs."],
  ["Liver", "Jigar", "ALT and AST are liver tests."],
  ["Thyroid", "Gale ki gland", "TSH is the thyroid test."],
  ["Urine", "Peshab", "Urine pH and protein tests."],
  ["Cholesterol", "Khoon mein charbi", "A fat carried in the blood."],
  ["Report", "Report / Nateeja", "Your lab result sheet."],
  ["Ask your doctor", "Apne doctor se poochein", "Only a doctor can diagnose."],
];

export function UrduWords() {
  const [q, setQ] = useState("");
  const rows = WORDS.filter((w) => !q || w.join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in English or Roman Urdu" className={`${field} max-w-sm`} />
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {rows.map(([en, ur, note], i) => (
          <motion.li key={en} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="rounded-2xl border border-ink/15 bg-white p-3">
            <p className="font-semibold text-ink">
              {en} <span className="text-muted">=</span> <span className="text-brand">{ur}</span>
            </p>
            <p className="text-sm text-muted">{note}</p>
          </motion.li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">Everyday words to help families talk about a report. General information only.</p>
    </div>
  );
}

/* ------------------------------------------------------------ 7. api playground */

const SAMPLE_BODY = JSON.stringify({ reportText: "Patient Name: Test Person\nAge: 45\nSex: Male\n- FBS: 350 mg/dL\n- SGPT: 30 U/L", explain: false }, null, 2);

export function ApiPlayground() {
  const [body, setBody] = useState(SAMPLE_BODY);
  const [resp, setResp] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const t = performance.now();
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const json = await res.json();
      setStatus(res.status);
      if (json.sessionId) json.sessionId = `${String(json.sessionId).slice(0, 24)}…`;
      setResp(JSON.stringify(json, null, 2));
    } catch (e) {
      setStatus(0);
      setResp(String(e));
    } finally {
      setMs(Math.round(performance.now() - t));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <p className="mb-2 font-mono text-sm text-ink">POST /api/analyze</p>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} spellCheck={false} className={`${field} font-mono text-xs`} />
        <div className="mt-3 flex flex-wrap gap-3">
          <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={send} disabled={busy} className={btn}>
            {busy ? "Sending..." : "Send request"}
          </motion.button>
          <button type="button" onClick={() => setBody('{ "age": 30 }')} className={ghost}>
            Try a bad request
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-3 text-xs text-white">
          {`curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/analyze \\\n  -H "Content-Type: application/json" \\\n  -d '{"reportText":"...","explain":false}'`}
        </pre>
      </div>
      <div>
        <p className="mb-2 text-sm text-muted">{status !== null ? `HTTP ${status} · ${ms} ms` : "The response appears here."}</p>
        <pre className="thin-scroll max-h-[26rem] overflow-auto rounded-xl border border-ink/15 bg-white p-3 text-xs text-ink">{resp ?? ""}</pre>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ install */

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

export function InstallButton() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", () => setDone(true));
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (done) return <span className="text-sm font-semibold text-forest">Installed ✓</span>;
  if (!evt) return null;
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      type="button"
      onClick={async () => {
        await evt.prompt();
        setEvt(null);
      }}
      className={ghost}
    >
      📲 Install Samjho on this device
    </motion.button>
  );
}
