"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export interface SampleInfo {
  id: string;
  file: string;
  label: string;
  tests: string[];
}

interface HeroProps {
  samples: SampleInfo[];
  text: string;
  fileName: string | null;
  busy: boolean;
  error: string | null;
  onText: (text: string, fileName: string | null) => void;
  onPick: (sample: SampleInfo) => void;
  onAnalyze: () => void;
  /** A file shared into Samjho from another app (WhatsApp, Gallery). */
  incomingFile?: File | null;
}

export const DEMO_FILES = [
  { file: "demo_1_ayesha_full_checkup.md", label: "Ayesha: full check-up, one urgent result" },
  { file: "demo_1b_ayesha_followup.md", label: "Ayesha again: six weeks later, shows her history" },
  { file: "demo_2_bilal_missing_details.md", label: "Bilal: age and sex missing" },
  { file: "demo_3_sana_messy_layout.md", label: "Sana: messy layout, unknown test" },
];

export default function Hero({ samples, text, fileName, busy, error, onText, onPick, onAnalyze, incomingFile }: HeroProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const [ocr, setOcr] = useState<number | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setTooBig(false);
    setOcrNote(null);

    // A photo or screenshot of a report: read the text out of it in the browser.
    // The image never leaves this device. Only the text goes on to the rules engine.
    if (file.type.startsWith("image/")) {
      if (file.size > 12_000_000) {
        setTooBig(true);
        return;
      }
      setOcr(0);
      try {
        const { recognize } = await import("tesseract.js");
        const { data } = await recognize(file, "eng", {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") setOcr(Math.round(m.progress * 100));
          },
        });
        const read = data.text.trim();
        if (read.length < 20) {
          setOcrNote("We could not read any text in that picture. Try a sharper, straight-on photo, or paste the text.");
        } else {
          onText(read, file.name);
          setOcrNote(`Read from the photo (${Math.round(data.confidence)}% confidence). Check the numbers below against your paper report before you continue.`);
        }
      } catch {
        setOcrNote("The photo reader could not start. Check your connection, or paste the text instead.");
      } finally {
        setOcr(null);
      }
      return;
    }

    if (file.size > 400_000) {
      setTooBig(true);
      return;
    }
    onText(await file.text(), file.name);
  }

  // A report shared from another app goes through the same path as an upload.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the shared file updates the upload state
    if (incomingFile) void readFile(incomingFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingFile]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <section id="top" className="scroll-mt-16 border-t border-ink/10 bg-cream">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1fr] lg:items-start lg:gap-14 lg:py-20">
        <div className="lg:pt-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold tracking-[0.16em] text-ink uppercase">
            <span className="h-2.5 w-2.5 rounded-full bg-forest" aria-hidden="true" />
            For CityLab reports · English and Roman Urdu
          </p>
          <h2 className="font-display mt-5 text-6xl leading-[0.98] font-semibold tracking-tight text-ink sm:text-7xl">
            Now yours.
            <br />
            <span className="text-brand">Paste it in.</span>
          </h2>
          <ol className="mt-7 grid max-w-md gap-4 text-lg text-ink">
            {[
              ["Add your report", "Paste the text, upload the file, or pick a sample."],
              ["See each result", "Normal, low, high or urgent, with the lab's own range."],
              ["Take it to your doctor", "Plain explanation, questions to ask, a sheet to print."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-2xl leading-none font-semibold text-white">{i + 1}</span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-base text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5 }} className="card-strong rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl font-semibold text-ink">Your report</h2>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-ink/25 bg-white px-3.5 py-1.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M10 13V3m0 0L6.500 6.500M10 3l3.500 3.500M3.500 13.500v2a1.500 1.500 0 001.500 1.500h10a1.500 1.500 0 001.500-1.500v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upload file or photo
            </button>
            <input ref={fileInput} type="file" accept=".md,.txt,.markdown,text/plain,text/markdown,image/*" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
          </div>

          <label htmlFor="report" className="sr-only">
            Report text
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              readFile(e.dataTransfer.files?.[0]);
            }}
            className={`mt-4 rounded-2xl border transition ${dragging ? "border-brand bg-brand/5" : "border-ink/20 bg-cream/50"}`}
          >
            <textarea
              id="report"
              value={text}
              onChange={(e) => onText(e.target.value, null)}
              rows={6}
              spellCheck={false}
              placeholder={"Paste the report here, or drop a file or a photo of it.\n\nPatient Name: ...\nAge: 42    Sex: Female\n- Hemoglobin: 6.5 g/dL"}
              className="thin-scroll block h-40 w-full resize-none rounded-2xl bg-transparent p-4 font-mono text-[0.82rem] leading-relaxed text-ink placeholder:text-muted focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-2 text-xs text-muted">
              <span className="truncate">{fileName ? fileName : "Pasted text"}</span>
              <span className="shrink-0 tabular-nums">{words.toLocaleString()} words</span>
            </div>
          </div>
          {tooBig && <p className="mt-2 text-sm text-urgent">That file is too large. Use a text file of a few pages, or a photo under 12 MB.</p>}
          {ocr !== null && (
            <div className="mt-3" role="status">
              <p className="text-sm font-semibold text-ink">Reading the photo on your device... {ocr}%</p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-deep">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.max(4, ocr)}%` }} />
              </div>
            </div>
          )}
          {ocrNote && <p className="mt-3 rounded-xl border border-sun bg-sun/20 px-4 py-2.5 text-sm text-ink">{ocrNote}</p>}

          <button
            type="button"
            onClick={onAnalyze}
            disabled={busy || ocr !== null || !text.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-lg font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Reading it against the lab&apos;s sheets
              </>
            ) : (
              "Explain my report"
            )}
          </button>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-urgent/40 bg-urgent/10 px-4 py-3 text-sm text-urgent">
              {error}
            </p>
          )}

          <div className="mt-6 border-t border-ink/10 pt-4">
            <p className="text-sm font-semibold text-ink">No report on you? Try one of the lab&apos;s 14 samples</p>
            <div className="thin-scroll mt-2.5 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
              {samples.length === 0 && Array.from({ length: 8 }, (_, i) => <span key={i} className="skeleton h-8 w-28 rounded-full" aria-hidden="true" />)}
              {samples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setLoadingId(s.id);
                    try {
                      await onPick(s);
                    } finally {
                      setLoadingId(null);
                    }
                  }}
                  title={`${s.file}\nTests: ${s.tests.join(", ")}`}
                  className={`rounded-full border px-3 py-1.5 text-left text-sm font-medium transition disabled:opacity-60 ${
                    fileName === s.file ? "border-ink bg-ink text-white" : "border-ink/20 bg-white text-ink hover:border-brand hover:text-brand"
                  }`}
                >
                  {loadingId === s.id ? "Loading..." : s.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">
              Demo files to download:{" "}
              {DEMO_FILES.map((d, i) => (
                <span key={d.file}>
                  <a href={`/demo/${d.file}`} download className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-2 hover:text-brand">
                    {d.label.split(":")[0]}
                  </a>
                  {i < DEMO_FILES.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
