"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { TubeFallback } from "./TestTube";

const TubeScene = dynamic(() => import("./three/TubeScene"), { ssr: false, loading: () => null });

const LAYERS = [
  { name: "Cleaner", what: "Cuts the 96% boilerplate. Keeps line numbers for citations.", tone: "bg-white" },
  { name: "Reference loader", what: "Turns the lab's sheets into tables at build time: 13 ranges, 9 aliases, 4 urgent limits.", tone: "bg-white" },
  { name: "Report parser", what: "Reads name, age, sex and tests from 6+ layouts, or from a photo.", tone: "bg-white" },
  { name: "Rules engine", what: "Aliases, unit conversion, urgent check, range by age and sex, or asks. 267 tests.", tone: "bg-brand text-white" },
  { name: "AI writer", what: "Groq, free tier. Sees only the labelled results: no name, no MRN.", tone: "bg-white" },
  { name: "Guard", what: "No new numbers, no diagnosis words. One retry, then a safe template.", tone: "bg-ink text-white" },
  { name: "Privacy lock", what: "One signed session per report. Other patients refused in code.", tone: "bg-white" },
];

export default function Closing({ use3D }: { use3D: boolean }) {
  return (
    <>
      <section className="border-t border-ink/10 bg-cream-deep/50" aria-label="How it works">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">Under the hood</p>
          <h2 className="font-display mt-2 max-w-3xl text-5xl leading-[1.02] font-semibold text-ink sm:text-6xl">The AI explains. The rules decide what the numbers say.</h2>
          <ol className="mt-10 grid gap-3 md:grid-cols-7">
            {LAYERS.map((l, i) => (
              <motion.li
                key={l.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 200, damping: 22 }}
                className={`relative rounded-2xl border border-ink/20 p-4 ${l.tone}`}
              >
                <p className="font-mono text-xs opacity-60">{String(i + 1).padStart(2, "0")}</p>
                <p className="font-display mt-1 text-2xl leading-tight font-semibold">{l.name}</p>
                <p className="mt-1.5 text-sm leading-snug opacity-80">{l.what}</p>
              </motion.li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl text-lg text-muted">
            If the AI is down or rate limited, every result and every warning still works. Before real clinical use, the rules and safety flow need review by clinicians.
          </p>
        </div>
      </section>

      <section className="border-t border-ink/10" aria-label="Back to 6.0">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">Back to that number</p>
            <h2 className="font-display mt-2 text-7xl leading-none font-semibold text-ink sm:text-8xl">
              6.0 <span className="font-sans text-2xl font-semibold text-muted">mmol/L</span>
            </h2>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="mt-5 text-2xl leading-relaxed text-ink">
              is <strong>108 mg/dL</strong>. The lab says <strong>70 to 99</strong>. So it&apos;s <span className="rounded-full bg-sun px-3 py-0.5 font-semibold">high</span>, not urgent. Worth a conversation with your doctor, and here are the questions to ask.
            </motion.p>
            <p className="mt-8 max-w-xl text-xl leading-relaxed text-muted">
              Nobody should need a medical degree, three Google searches and a family WhatsApp group to understand their own report.
            </p>
            <p className="font-display mt-8 text-4xl leading-tight font-semibold text-ink">
              Samjho turns medical data into <span className="text-brand">medical understanding.</span>
            </p>
            <p className="mt-6 text-lg text-ink">
              Ahmed Malik · <strong className="font-bold">4x National Hackathon Winner</strong> · solo developer, Tech Fusion &apos;26 ·{" "}
              <a href="https://www.linkedin.com/in/ahhmedmalik" target="_blank" rel="noreferrer" className="font-semibold text-[#0a66c2] underline underline-offset-4">
                LinkedIn
              </a>
            </p>
          </div>
          <div className="relative mx-auto h-80 w-48 sm:h-96 sm:w-56">
            {use3D ? <TubeScene level={0.9} color="#f59e0b" urgent={false} showMarks /> : <TubeFallback level={0.9} color="#f59e0b" urgent={false} showMarks />}
            <p className="absolute -right-24 top-[22%] hidden text-sm font-semibold text-ink sm:block">← your 108</p>
            <p className="absolute -right-24 top-[33%] hidden text-sm text-muted sm:block">← top of normal, 99</p>
          </div>
        </div>
      </section>
    </>
  );
}
