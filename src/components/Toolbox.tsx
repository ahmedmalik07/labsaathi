"use client";

/**
 * Everyday tools on the Tools page. Every number here comes from the lab's own
 * files through /api/reference, or from the same rules engine as the main app.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { AnalyzeResponse } from "@/lib/pipeline";
import type { ReferenceTables } from "@/lib/types";
import { Tilt } from "./Motion";
import ResultCard from "./ResultCard";
import TestIcon from "./TestIcon";

type ToolId = "check" | "convert" | "ranges" | "urgent" | "shortforms" | "guide" | "visit";

const TOOLS: Array<{ id: ToolId; title: string; blurb: string; emoji: string }> = [
  { id: "check", title: "Check one number", blurb: "Only have one value? Type it in.", emoji: "🔎" },
  { id: "convert", title: "Unit converter", blurb: "mmol/L or mg/dL? g/L or g/dL?", emoji: "🔁" },
  { id: "ranges", title: "The lab's normal ranges", blurb: "Every range in the lab's sheets.", emoji: "📏" },
  { id: "urgent", title: "Danger limits", blurb: "When to see a doctor today.", emoji: "🚨" },
  { id: "shortforms", title: "What does SGPT mean?", blurb: "Short forms on your report, decoded.", emoji: "🔤" },
  { id: "guide", title: "What each test is for", blurb: "In plain words, one line each.", emoji: "📘" },
  { id: "visit", title: "Doctor visit checklist", blurb: "What to bring and what to ask.", emoji: "🩺" },
];

const GUIDE: Array<{ test: string; what: string }> = [
  { test: "Hemoglobin", what: "The part of red blood cells that carries oxygen around your body." },
  { test: "White Blood Cell Count", what: "Cells that help your body fight germs." },
  { test: "Platelet Count", what: "Tiny cells that help your blood clot when you get a cut." },
  { test: "Red Blood Cell Count", what: "How many oxygen-carrying cells are in your blood." },
  { test: "Fasting Blood Sugar", what: "Sugar in your blood after not eating for several hours." },
  { test: "ALT", what: "An enzyme mostly found in the liver. Also called SGPT." },
  { test: "AST", what: "An enzyme found in the liver and muscles. Also called SGOT." },
  { test: "Cholesterol", what: "A fat carried in your blood." },
  { test: "TSH", what: "A hormone that tells the thyroid gland how hard to work." },
  { test: "Urine pH", what: "How acidic or basic your urine is." },
  { test: "Urine Protein", what: "Whether protein is passing into your urine. Usually there is none." },
];

const CHECKLIST = [
  "Bring the printed report, or this page's doctor sheet.",
  "Bring older reports if you have them, so the doctor can see changes.",
  "Write down any medicines and supplements you take.",
  "Note when the sample was taken, and whether you had eaten.",
  "Ask: which of these results matter most for me?",
  "Ask: do I need to repeat any test, and when?",
  "Ask: is there anything I should change before the next test?",
];

/* ---------------------------------------------------------------- tools */

function QuickCheck({ tables, use3D }: { tables: ReferenceTables; use3D: boolean }) {
  const tests = useMemo(() => [...new Set(tables.ranges.map((r) => r.test))], [tables]);
  const [test, setTest] = useState(tests[0] ?? "Hemoglobin");
  const units = useMemo(() => {
    const u = new Set(tables.ranges.filter((r) => r.test === test && r.unit).map((r) => r.unit as string));
    if (test === "Fasting Blood Sugar") u.add("mmol/L");
    return [...u];
  }, [tables, test]);
  const qualitative = tables.ranges.some((r) => r.test === test && r.qualitative);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<AnalyzeResponse | null>(null);
  const chosenUnit = unit && units.includes(unit) ? unit : (units[0] ?? "");

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    const report = [
      "Patient Name: Quick check",
      `Age: ${age || "[NOT PROVIDED]"}`,
      `Sex: ${sex || "[NOT PROVIDED]"}`,
      `- ${test}: ${value.trim()}${!qualitative && chosenUnit ? " " + chosenUnit : ""}`,
    ].join("\n");
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportText: report, explain: false }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "That could not be checked.");
      setOut(json as AnalyzeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be checked.");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl border border-ink/25 bg-white px-3.5 py-2.5 text-base text-ink focus:border-brand focus:outline-none";
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <form onSubmit={run} className="grid content-start gap-3">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Test
          <select value={test} onChange={(e) => { setTest(e.target.value); setOut(null); }} className={field}>
            {tests.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Your value
            <input value={value} onChange={(e) => setValue(e.target.value.slice(0, 20))} placeholder={qualitative ? "e.g. Negative" : "e.g. 6.0"} inputMode={qualitative ? "text" : "decimal"} className={field} />
          </label>
          {!qualitative && units.length > 0 && (
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Unit
              <select value={chosenUnit} onChange={(e) => setUnit(e.target.value)} className={field}>
                {units.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Age
            <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="optional" inputMode="numeric" className={field} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Sex
            <select value={sex} onChange={(e) => setSex(e.target.value)} className={field}>
              <option value="">not given</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </label>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={busy || !value.trim()} className="rounded-full bg-brand px-5 py-3 text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-45">
          {busy ? "Checking..." : "Check it"}
        </motion.button>
        <p className="text-sm text-muted">Leave age or sex empty and see what happens: if the range depends on it, Samjho asks instead of guessing.</p>
        {error && <p className="text-sm text-urgent">{error}</p>}
      </form>
      <div className="min-h-[14rem]">
        <AnimatePresence mode="wait">
          {out?.results[0] ? (
            <motion.div key={out.sessionId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <ResultCard result={out.results[0]} index={0} use3D={use3D} />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full min-h-[14rem] items-center justify-center rounded-3xl border-2 border-dashed border-ink/20 p-6 text-center text-muted">
              Your result appears here, with the tube, the range and how it was worked out.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Converter() {
  const [kind, setKind] = useState<"glucose" | "hb">("glucose");
  const [a, setA] = useState("6.0");
  const n = Number(a);
  const ok = a.trim() !== "" && Number.isFinite(n);
  const result = kind === "glucose" ? Math.round(n * 18 * 10) / 10 : Math.round(n * 0.1 * 100) / 100;
  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["glucose", "Blood sugar: mmol/L → mg/dL"],
            ["hb", "Hemoglobin: g/L → g/dL"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setKind(id)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${kind === id ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink/5"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-2xl text-ink">
        <input value={a} onChange={(e) => setA(e.target.value.slice(0, 10))} inputMode="decimal" className="w-32 rounded-xl border border-ink/25 bg-white px-3 py-2 text-2xl font-bold tabular-nums focus:border-brand focus:outline-none" />
        <span className="text-muted">{kind === "glucose" ? "mmol/L" : "g/L"}</span>
        <span aria-hidden="true">=</span>
        <motion.span key={`${kind}-${a}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-xl bg-sun/30 px-3 py-1 font-bold tabular-nums">
          {ok ? result : "?"}
        </motion.span>
        <span className="text-muted">{kind === "glucose" ? "mg/dL" : "g/dL"}</span>
      </div>
      <p className="mt-4 text-sm text-muted">
        {kind === "glucose"
          ? "Sugar: mg/dL = mmol/L × 18. This factor is not in the lab's files; it comes from the hackathon brief, and Samjho says so whenever it uses it."
          : "Hemoglobin: g/dL = g/L ÷ 10. This is plain metric scaling (1 dL is a tenth of a litre)."}
      </p>
    </div>
  );
}

function RangesTable({ tables }: { tables: ReferenceTables }) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"" | "male" | "female">("");
  const a = Number(age);
  const rows = tables.ranges.filter((r) => (!sex || r.sex === "all" || r.sex === sex) && (!age || (a >= r.ageMin && a <= r.ageMax)));
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Show ranges for age
          <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="any" inputMode="numeric" className="w-24 rounded-xl border border-ink/25 bg-white px-3 py-2 text-base focus:border-brand focus:outline-none" />
        </label>
        <div className="flex gap-1.5 rounded-full bg-white p-1">
          {(["", "female", "male"] as const).map((s) => (
            <button key={s || "any"} type="button" onClick={() => setSex(s)} className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${sex === s ? "bg-ink text-white" : "text-ink"}`}>
              {s || "any sex"}
            </button>
          ))}
        </div>
      </div>
      {age && rows.length === 0 && <p className="mt-4 rounded-xl bg-sun/20 px-4 py-3 text-ink">The lab&apos;s sheets have no ranges for age {age}. They cover ages 18 to 100 only, so Samjho would say &quot;cannot be classified&quot;.</p>}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/15 bg-white">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-cream-deep/60 text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-2.5">Test</th>
              <th className="px-4 py-2.5">Who</th>
              <th className="px-4 py-2.5">Normal</th>
              <th className="px-4 py-2.5">From</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <motion.tr key={`${r.test}-${r.sex}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-t border-ink/10">
                <td className="px-4 py-2.5 font-semibold text-ink">{r.test}</td>
                <td className="px-4 py-2.5 text-ink/80 capitalize">
                  {r.sex === "all" ? "everyone" : r.sex}, {r.ageMin} to {r.ageMax}
                </td>
                <td className="px-4 py-2.5 font-semibold text-ink tabular-nums">{r.qualitative ?? `${r.low} to ${r.high}${r.unit ? " " + r.unit : ""}`}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">
                  {r.source.file}:{r.source.line}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">A value exactly on a limit counts as normal. That rule is in 4_ranges_hematology.md.</p>
    </div>
  );
}

function UrgentList({ tables }: { tables: ReferenceTables }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tables.urgent.map((u, i) => (
        <motion.div key={u.test} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="flex items-center gap-4 rounded-2xl border border-urgent/40 bg-white p-4">
          <TestIcon name={u.test} color="#c81e1e" urgent />
          <div>
            <p className="font-display text-2xl font-semibold text-ink">{u.test}</p>
            <p className="text-lg text-ink">
              {u.direction === "low" ? "At or below" : "At or above"} <strong className="tabular-nums">{u.threshold.toLocaleString()}</strong> {u.unit}
            </p>
            <p className="font-mono text-xs text-muted">
              {u.source.file}:{u.source.line}
            </p>
          </div>
        </motion.div>
      ))}
      <p className="text-sm text-muted sm:col-span-2">If a result reaches one of these, Samjho shows a red &quot;See a doctor today&quot; banner. The file says results that &quot;hit or pass&quot; a limit, so a value exactly on it counts.</p>
    </div>
  );
}

function ShortForms({ tables }: { tables: ReferenceTables }) {
  const [q, setQ] = useState("");
  const rows = tables.aliases.filter((a) => !q || `${a.alias} ${a.canonical}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a short form, e.g. sgot" className="w-full max-w-sm rounded-xl border border-ink/25 bg-white px-3.5 py-2.5 text-base focus:border-brand focus:outline-none" />
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {rows.map((a) => (
            <motion.li key={a.alias} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-3 rounded-2xl border border-ink/15 bg-white p-3">
              <span className="rounded-lg bg-ink px-2.5 py-1 font-mono text-sm font-bold text-white">{a.alias}</span>
              <span aria-hidden="true" className="text-muted">
                =
              </span>
              <span className="font-semibold text-ink">{a.canonical}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <p className="mt-3 text-sm text-muted">From the lab&apos;s glossary, 2_medical_glossary.md. Capital or small letters both work.</p>
    </div>
  );
}

function Guide() {
  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {GUIDE.map((g, i) => (
          <motion.li key={g.test} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3 rounded-2xl border border-ink/15 bg-white p-3">
            <TestIcon name={g.test} color="#e8501f" />
            <span>
              <span className="block font-semibold text-ink">{g.test}</span>
              <span className="block text-sm text-muted">{g.what}</span>
            </span>
          </motion.li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">General information to help you read a report. It is not used to decide any result, and it is not medical advice.</p>
    </div>
  );
}

function Visit() {
  const [done, setDone] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  return (
    <div className="max-w-2xl">
      <ul className="grid gap-2">
        {CHECKLIST.map((c, i) => {
          const on = done.includes(i);
          return (
            <li key={c}>
              <button type="button" onClick={() => setDone((d) => (on ? d.filter((x) => x !== i) : [...d, i]))} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${on ? "border-forest bg-forest/10" : "border-ink/15 bg-white hover:border-ink/40"}`}>
                <motion.span animate={{ scale: on ? [1, 1.25, 1] : 1 }} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold ${on ? "border-forest bg-forest text-white" : "border-ink/40"}`}>
                  {on ? "✓" : ""}
                </motion.span>
                <span className={on ? "text-ink/60 line-through" : "text-ink"}>{c}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(CHECKLIST.map((c) => `- ${c}`).join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            setCopied(false);
          }
        }}
        className="mt-4 rounded-full border border-ink/25 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
      >
        {copied ? "Copied" : "Copy the checklist"}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- page */

export default function Toolbox({ use3D }: { use3D: boolean }) {
  const [tables, setTables] = useState<ReferenceTables | null>(null);
  const [tool, setTool] = useState<ToolId>("check");

  useEffect(() => {
    fetch("/api/reference")
      .then((r) => r.json())
      .then(setTables)
      .catch(() => setTables(null));
  }, []);

  const current = TOOLS.find((t) => t.id === tool)!;

  return (
    <section id="tools" className="scroll-mt-16 border-t border-ink/10" aria-label="More tools">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">More tools</p>
        <h2 className="font-display mt-1 text-5xl leading-none font-semibold text-ink">Not a full report? Start here.</h2>

        <div className="thin-scroll mt-6 -mx-5 flex gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7">
          {TOOLS.map((t) => (
            <Tilt key={t.id} className="shrink-0" max={6}>
              <button
                type="button"
                onClick={() => setTool(t.id)}
                aria-pressed={tool === t.id}
                className={`flex h-full w-40 flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition sm:w-auto ${tool === t.id ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink hover:border-brand"}`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {t.emoji}
                </span>
                <span className="font-semibold leading-tight">{t.title}</span>
                <span className={`text-xs leading-snug ${tool === t.id ? "text-white/75" : "text-muted"}`}>{t.blurb}</span>
              </button>
            </Tilt>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-ink/15 bg-cream-deep/40 p-5 sm:p-7">
          <AnimatePresence mode="wait">
            <motion.div key={tool} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
              <h3 className="font-display mb-5 text-3xl font-semibold text-ink">{current.title}</h3>
              {!tables && tool !== "convert" && tool !== "guide" && tool !== "visit" ? (
                <div className="grid gap-2" aria-hidden="true">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="skeleton h-10 rounded-xl" />
                  ))}
                </div>
              ) : (
                <>
                  {tool === "check" && tables && <QuickCheck tables={tables} use3D={use3D} />}
                  {tool === "convert" && <Converter />}
                  {tool === "ranges" && tables && <RangesTable tables={tables} />}
                  {tool === "urgent" && tables && <UrgentList tables={tables} />}
                  {tool === "shortforms" && tables && <ShortForms tables={tables} />}
                  {tool === "guide" && <Guide />}
                  {tool === "visit" && <Visit />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
