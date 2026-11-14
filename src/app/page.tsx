"use client";

import { useEffect, useState } from "react";

interface Result {
  canonicalName: string;
  originalName: string;
  rawValue: string;
  unit: string | null;
  status: string;
  summary: string;
  trace: Array<{ step: string; detail: string; source?: { file: string; line: number } }>;
}

interface Analysis {
  patient: { name: string | null; age: number | null; sex: string | null; mrn: string | null };
  results: Result[];
  urgent: boolean;
  urgentMessage: string | null;
  needsInfo: Array<{ field: string; question: string }>;
  explanation: string;
  doctorQuestions: string[];
}

export default function Home() {
  const [samples, setSamples] = useState<Array<{ id: string; label: string }>>([]);
  const [text, setText] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/samples")
      .then((r) => r.json())
      .then((j) => setSamples(j.samples ?? []))
      .catch(() => setSamples([]));
  }, []);

  async function pick(id: string) {
    const res = await fetch(`/api/samples/${id}`);
    const json = await res.json();
    setText(json.reportText ?? "");
    setData(null);
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportText: text, age: age || undefined, sex: sex || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Request failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">LabSaathi</h1>
      <p>Paste a lab report or pick a sample.</p>
      <div className="flex flex-wrap gap-2">
        {samples.map((s) => (
          <button key={s.id} onClick={() => pick(s.id)} className="rounded border px-2 py-1 text-sm">
            {s.id} {s.label}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="w-full rounded border p-2 font-mono text-sm" placeholder="Report text" />
      <div className="flex gap-2">
        <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age (if missing)" className="rounded border p-2" />
        <select value={sex} onChange={(e) => setSex(e.target.value)} className="rounded border p-2">
          <option value="">Sex (if missing)</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
        <button onClick={analyze} disabled={busy || !text.trim()} className="rounded bg-teal-600 px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Analysing..." : "Analyse"}
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {data && (
        <section className="flex flex-col gap-3">
          {data.urgent && <p className="rounded bg-red-600 p-3 font-semibold text-white">{data.urgentMessage}</p>}
          <p>
            Patient: {data.patient.name ?? "unknown"}, age {data.patient.age ?? "missing"}, sex {data.patient.sex ?? "missing"}
          </p>
          {data.needsInfo.map((n) => (
            <p key={n.field} className="rounded border border-violet-500 p-2">
              {n.question}
            </p>
          ))}
          {data.results.map((r) => (
            <details key={r.canonicalName + r.rawValue} className="rounded border p-3">
              <summary>
                <strong>{r.status.toUpperCase()}</strong> {r.summary}
              </summary>
              <ol className="mt-2 list-decimal pl-5 text-sm">
                {r.trace.map((t, i) => (
                  <li key={i}>
                    {t.detail} {t.source && <em>[{t.source.file}:{t.source.line}]</em>}
                  </li>
                ))}
              </ol>
            </details>
          ))}
          <pre className="whitespace-pre-wrap rounded border p-3 text-sm">{data.explanation}</pre>
          <ul className="list-disc pl-5">
            {data.doctorQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
