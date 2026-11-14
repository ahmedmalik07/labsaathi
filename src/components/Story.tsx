"use client";

import { motion } from "framer-motion";

type Tag = { text: string; tone: "ok" | "warn" | "urgent" | "ask" } | null;

interface Line {
  name: string;
  value: string;
  tag: Tag;
  note?: string;
}

const RAW: Line[] = [
  { name: "SGPT", value: "45 U/L", tag: null },
  { name: "FBS", value: "6.0 mmol/L", tag: null },
  { name: "Hb", value: "6.5 g/dL", tag: null },
  { name: "S. Ferritin", value: "25 ng/mL", tag: null },
];

const READ: Line[] = [
  { name: "SGPT", value: "45 U/L", tag: { text: "Normal", tone: "ok" }, note: "SGPT is ALT. Limit for women is 45, and on the limit counts as normal." },
  { name: "FBS", value: "6.0 mmol/L", tag: { text: "High", tone: "warn" }, note: "That is 108 mg/dL. The sheet says 70 to 99." },
  { name: "Hb", value: "6.5 g/dL", tag: { text: "See a doctor today", tone: "urgent" }, note: "Below the lab's urgent limit of 7.0." },
  { name: "S. Ferritin", value: "25 ng/mL", tag: { text: "Can't say", tone: "ask" }, note: "The lab's sheets have no range for it. We won't make one up." },
];

const TONE: Record<NonNullable<Tag>["tone"], string> = {
  ok: "bg-forest text-white",
  warn: "bg-sun text-ink",
  urgent: "bg-urgent text-white",
  ask: "bg-white text-ink border border-ink/40",
};

function Slip({ lines, tilt = 0, scribble }: { lines: Line[]; tilt?: number; scribble?: string }) {
  return (
    <div className="relative mx-auto w-full max-w-sm" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="rounded-sm border border-ink/20 bg-white px-5 py-5 shadow-[4px_4px_0_rgba(22,19,15,0.12)]">
        <p className="font-mono text-[0.68rem] tracking-[0.18em] text-muted uppercase">CityLab Diagnostics · Results</p>
        <div className="mt-3 border-t border-dashed border-ink/25" />
        <ul className="mt-1">
          {lines.map((l) => (
            <li key={l.name} className="border-b border-dashed border-ink/15 py-2.5 last:border-b-0">
              <div className="flex items-center justify-between gap-3 font-mono text-sm text-ink">
                <span>{l.name}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{l.value}</span>
                  {l.tag && <span className={`rounded-full px-2 py-0.5 font-sans text-[0.7rem] font-semibold ${TONE[l.tag.tone]}`}>{l.tag.text}</span>}
                </span>
              </div>
              {l.note && <p className="mt-1 text-[0.82rem] leading-snug text-muted">{l.note}</p>}
            </li>
          ))}
        </ul>
      </div>
      {scribble && (
        <p className="font-display absolute -right-2 -bottom-7 rotate-[-4deg] text-2xl font-semibold text-brand italic sm:-right-6" aria-hidden="true">
          {scribble}
        </p>
      )}
    </div>
  );
}

function SearchBox() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-full border border-ink/25 bg-white px-4 py-2.5 text-sm text-ink">
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="9" cy="9" r="5.500" />
          <path d="M13.500 13.500L17 17" strokeLinecap="round" />
        </svg>
        hb 6.5 kya matlab hai
      </div>
      <ul className="mt-3 space-y-2 pl-4 text-sm text-muted">
        <li className="line-through decoration-ink/30">10 serious conditions linked to low hemoglobin</li>
        <li className="line-through decoration-ink/30">Is it cancer? Forum thread, 214 replies</li>
        <li className="line-through decoration-ink/30">Normal range (US adults, different lab)</li>
      </ul>
      <p className="mt-3 pl-4 text-sm font-medium text-ink">None of these know your age, your sex, or your lab.</p>
    </div>
  );
}

const CHAPTERS: Array<{ eyebrow: string; line: string; body: string; visual: React.ReactNode }> = [
  {
    eyebrow: "The envelope",
    line: "This is a lab report.",
    body: "You paid for it, you waited for it, and it came back like this.",
    visual: <Slip lines={RAW} tilt={-2} />,
  },
  {
    eyebrow: "The problem",
    line: "Short forms, numbers, and nobody to ask.",
    body: "Is 45 good? What is SGPT? Why is one result in mmol/L when everything online is in mg/dL?",
    visual: <Slip lines={RAW} tilt={1.5} scribble="??" />,
  },
  {
    eyebrow: "2 a.m.",
    line: "So you search. And it tells you the worst.",
    body: "The internet does not have your report. It guesses, and it guesses scary.",
    visual: <SearchBox />,
  },
  {
    eyebrow: "The answer sheet",
    line: "The lab already wrote down what normal is.",
    body: "Samjho reads your report against the lab's own range sheets. Each result gets a plain label and shows which file and line it came from. If the sheets do not cover something, it says so.",
    visual: <Slip lines={READ} tilt={0} />,
  },
];

export default function Story({ onStart }: { onStart: () => void }) {
  return (
    <section className="border-t border-ink/10" aria-label="Why Samjho exists">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        {CHAPTERS.map((c, i) => (
          <motion.div
            key={c.eyebrow}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className={`grid items-center gap-10 py-16 sm:py-24 md:grid-cols-2 md:gap-14 ${i > 0 ? "border-t border-ink/10" : ""}`}
          >
            <div className={i % 2 === 1 ? "md:order-2" : ""}>
              <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">{c.eyebrow}</p>
              <h2 className="font-display mt-3 text-4xl leading-[1.05] font-semibold text-ink sm:text-5xl">{c.line}</h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{c.body}</p>
            </div>
            <div className={i % 2 === 1 ? "md:order-1" : ""}>{c.visual}</div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55 }}
          className="border-t border-ink/10 py-16 sm:py-24"
        >
          <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">What it will not do</p>
          <h2 className="font-display mt-3 max-w-3xl text-4xl leading-[1.05] font-semibold text-ink sm:text-5xl">
            It explains numbers. It does not play doctor.
          </h2>
          <ul className="mt-8 grid gap-x-10 gap-y-5 text-lg text-ink sm:grid-cols-2">
            {[
              ["It never tells you that you have a disease.", "Only a licensed doctor can diagnose. Every answer says so."],
              ["It never guesses your age or sex.", "If the report leaves them out, it asks you. A name is not a clue."],
              ["It never invents a range.", "No range in the lab's files means the answer is: cannot be classified."],
              ["It never talks about another patient.", "One report per conversation. Ask about someone else and it refuses."],
            ].map(([a, b]) => (
              <li key={a} className="border-l-2 border-brand pl-4">
                <p className="font-semibold">{a}</p>
                <p className="mt-1 text-base text-muted">{b}</p>
              </li>
            ))}
          </ul>

          <div className="mt-14 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <button type="button" onClick={onStart} className="rounded-full bg-brand px-7 py-3.5 text-lg font-semibold text-white transition hover:bg-brand-dark">
              Read my report
            </button>
            <p className="text-muted">Takes a few seconds. Nothing to sign up for.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
