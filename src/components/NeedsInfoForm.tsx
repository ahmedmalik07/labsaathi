"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { NeedsInfo } from "@/lib/types";

interface Props {
  needsInfo: NeedsInfo[];
  busy: boolean;
  onSubmit: (values: { age?: string; sex?: string }) => void;
}

/** Inline form shown when the report is missing age or sex. Submitting re-runs the rules engine. */
export default function NeedsInfoForm({ needsInfo, busy, onSubmit }: Props) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const asksAge = needsInfo.some((n) => n.field === "age");
  const asksSex = needsInfo.some((n) => n.field === "sex");
  const blocking = needsInfo.some((n) => n.blocking.length > 0);
  const ageValid = !asksAge || age === "" || /^\d{1,3}$/.test(age);
  const ready = ageValid && ((asksAge && age !== "") || (asksSex && sex !== ""));
  const source = needsInfo.find((n) => n.source)?.source;

  return (
    <motion.form
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ age: age || undefined, sex: sex || undefined });
      }}
      className="rounded-3xl border border-violet-300/45 bg-violet-500/10 p-5 backdrop-blur sm:p-6"
      aria-label="Missing patient details"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-300 text-lg font-bold text-slate-950" aria-hidden="true">
          ?
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-white">{blocking ? "I need one more detail before I can label this" : "One detail is missing from the report"}</h3>
          <ul className="mt-1 grid gap-1 text-[0.95rem] leading-relaxed text-violet-50">
            {needsInfo.map((n) => (
              <li key={n.field}>{n.question}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-violet-100/90">
            Nothing is guessed. Sex is never read from a name.
            {source && (
              <>
                {" "}
                Rule: <span className="font-mono text-xs">{source.file}:{source.line}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {asksAge && (
          <label className="grid gap-1.5 text-sm font-medium text-white">
            Age in years
            <input
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              placeholder="e.g. 42"
              aria-invalid={!ageValid}
              className="w-32 rounded-xl border border-white/25 bg-black/30 px-3.5 py-2.5 text-base text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none"
            />
          </label>
        )}
        {asksSex && (
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-white">Biological sex</legend>
            <div className="flex gap-2">
              {[
                ["female", "Female"],
                ["male", "Male"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border px-4 py-2.5 text-base font-medium transition ${
                    sex === value ? "border-violet-200 bg-violet-300 text-slate-950" : "border-white/25 bg-black/30 text-white hover:border-violet-300"
                  }`}
                >
                  <input type="radio" name="sex" value={value} checked={sex === value} onChange={() => setSex(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <button type="submit" disabled={!ready || busy} className="rounded-xl bg-violet-300 px-5 py-2.5 text-base font-semibold text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Re-checking..." : "Update results"}
        </button>
      </div>
    </motion.form>
  );
}
