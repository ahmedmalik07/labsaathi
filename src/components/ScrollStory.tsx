"use client";

/**
 * The opening story. One pinned stage: as the reader scrolls, the same report
 * slip goes from unreadable, to confusing, to buried under search results, to
 * scanned and labelled, and finally becomes a rack of filled test tubes.
 * Pointer movement tilts the slip. The dots on the right jump between chapters.
 */
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const HeroScene = dynamic(() => import("./three/HeroScene"), { ssr: false, loading: () => null });
const RackScene = dynamic(() => import("./three/RackScene"), { ssr: false, loading: () => null });

type Tone = "ok" | "warn" | "urgent" | "ask";

const LINES: Array<{ name: string; value: string; tag: string; tone: Tone; note: string }> = [
  { name: "SGPT", value: "45 U/L", tag: "Normal", tone: "ok", note: "SGPT is ALT. On the limit counts as normal." },
  { name: "FBS", value: "6.0 mmol/L", tag: "High", tone: "warn", note: "That is 108 mg/dL. The sheet says 70 to 99." },
  { name: "Hb", value: "6.5 g/dL", tag: "See a doctor today", tone: "urgent", note: "Below the lab's urgent limit of 7.0." },
  { name: "S. Ferritin", value: "25 ng/mL", tag: "Can't say", tone: "ask", note: "No range in the lab's sheets. We won't invent one." },
];

const TONE: Record<Tone, string> = {
  ok: "bg-forest text-white",
  warn: "bg-sun text-ink",
  urgent: "bg-urgent text-white",
  ask: "bg-white text-ink border border-ink/40",
};

const CHAPTERS = [
  { eyebrow: "Scroll to begin", line: "Got a lab report you can't read?", accent: "Samjho.", body: "A short story first. It takes about twenty seconds of scrolling." },
  { eyebrow: "The envelope", line: "This is a lab report.", accent: "", body: "You paid for it, you waited for it, and it came back like this." },
  { eyebrow: "The problem", line: "Short forms, numbers, and nobody to ask.", accent: "", body: "Is 45 good? What is SGPT? Why is one result in mmol/L when everything online is in mg/dL?" },
  { eyebrow: "2 a.m.", line: "So you search. And it tells you the worst.", accent: "", body: "The internet does not know your age, your sex, or your lab. It guesses, and it guesses scary." },
  { eyebrow: "The answer sheet", line: "The lab already wrote down what normal is.", accent: "", body: "Samjho reads your report against the lab's own range sheets, line by line, and shows which file each answer came from. Keep scrolling to scan it." },
  { eyebrow: "Your turn", line: "Numbers explained. Doctor still in charge.", accent: "", body: "It never says you have a disease, never guesses your age or sex, never invents a range, and never talks about another patient." },
];

const SEARCH_HITS = [
  { text: "10 serious conditions linked to low hemoglobin", x: "-14%", y: "6%", r: -5 },
  { text: "Is it cancer? Forum thread, 214 replies", x: "30%", y: "38%", r: 4 },
  { text: "Normal range (US adults, a different lab)", x: "-8%", y: "72%", r: -2 },
];

const N = CHAPTERS.length;

export default function ScrollStory({ use3D, onGiveUp3D, onStart }: { use3D: boolean; onGiveUp3D: () => void; onStart: () => void }) {
  const section = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const [stage, setStage] = useState(0);
  const [sub, setSub] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const pos = Math.min(N - 0.001, Math.max(0, v * N));
    const s = Math.floor(pos);
    setStage(s);
    setSub(Math.round((pos - s) * 12) / 12);
  });

  // Pointer tilt, eased. Scroll adds a slow turn so the slip never sits still.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const tiltX = useSpring(useTransform(py, [-1, 1], [7, -7]), { stiffness: 120, damping: 18 });
  const pointerY = useSpring(useTransform(px, [-1, 1], [-10, 10]), { stiffness: 120, damping: 18 });
  const scrollTurn = useTransform(scrollYProgress, [0, 0.17, 0.5, 0.8], [-16, -6, 5, 0]);
  const tiltY = useTransform([pointerY, scrollTurn], ([a, b]: number[]) => (reduce ? 0 : a + b));
  const lift = useTransform(scrollYProgress, [0, 0.17], [40, 0]);

  const jump = (i: number) => {
    const el = section.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (span * (i + 0.35)) / N, behavior: reduce ? "auto" : "smooth" });
  };

  const c = CHAPTERS[stage];
  const scanned = stage > 4 ? LINES.length : stage === 4 ? Math.min(LINES.length, Math.floor(sub * 5.2)) : 0;
  const rack = stage === 5;

  return (
    <section ref={section} className="relative" style={{ height: `${N * 95}vh` }} aria-label="The story behind Samjho">
      <div
        className="sticky top-0 flex h-screen items-center overflow-hidden"
        onPointerMove={(e) => {
          px.set((e.clientX / window.innerWidth - 0.5) * 2);
          py.set((e.clientY / window.innerHeight - 0.5) * 2);
        }}
      >
        <div className="hero-static absolute inset-0 -z-20" aria-hidden="true" />
        {use3D && (
          <div className="absolute inset-0 -z-10">
            <HeroScene onGiveUp={onGiveUp3D} />
          </div>
        )}
        <div className="hero-fade pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-6 px-5 pt-16 sm:px-8 md:grid-cols-[1.05fr_1fr] md:gap-12">
          {/* ---- words ---- */}
          <div className="min-h-[15.5rem] sm:min-h-[19rem]">
            <AnimatePresence mode="wait">
              <motion.div key={stage} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                <p className="flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-muted uppercase">
                  <span className="tabular-nums text-brand">
                    {stage + 1}/{N}
                  </span>
                  {c.eyebrow}
                </p>
                <h2 className={`font-display mt-3 leading-[0.98] font-semibold tracking-tight text-ink ${stage === 0 ? "text-[3.3rem] sm:text-7xl lg:text-[5.2rem]" : "text-[2.6rem] sm:text-6xl"}`}>
                  {c.line}
                  {c.accent && (
                    <>
                      <br />
                      <span className="text-brand">{c.accent}</span>
                    </>
                  )}
                </h2>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-ink/75 sm:text-xl">{c.body}</p>
                {(stage === 0 || stage === N - 1) && (
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <button type="button" onClick={onStart} className="rounded-full bg-brand px-7 py-3.5 text-lg font-semibold text-white transition hover:bg-brand-dark">
                      {stage === 0 ? "Skip to my report" : "Read my report"}
                    </button>
                    {stage === 0 && (
                      <span className="flex items-center gap-3 text-sm font-semibold text-ink">
                        <span className="flex h-12 w-8 items-start justify-center rounded-full border-2 border-ink bg-white pt-2" aria-hidden="true">
                          <motion.span className="h-2 w-1.5 rounded-full bg-brand" animate={reduce ? undefined : { y: [0, 12, 0] }} transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }} />
                        </span>
                        or scroll
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ---- the stage ---- */}
          <div className="relative mx-auto h-[19rem] w-full max-w-sm sm:h-[26rem]" style={{ perspective: 1100 }}>
            {/* the slip */}
            <motion.div
              className="absolute inset-x-0 top-1/2"
              style={{ rotateX: reduce ? 0 : tiltX, rotateY: tiltY, y: lift, translateY: "-50%", transformStyle: "preserve-3d" }}
              animate={{ opacity: rack ? 0 : 1, scale: rack ? 0.7 : stage === 0 ? 0.92 : 1, filter: stage === 0 ? "blur(1.5px)" : "blur(0px)" }}
              transition={{ duration: 0.45 }}
            >
              <div className="relative overflow-hidden rounded-sm border border-ink/20 bg-white px-5 py-4 shadow-[10px_14px_0_rgba(22,19,15,0.13)]">
                <p className="font-mono text-[0.66rem] tracking-[0.18em] text-muted uppercase">CityLab Diagnostics · Results</p>
                <div className="mt-2.5 border-t border-dashed border-ink/25" />
                <ul>
                  {LINES.map((l, i) => (
                    <li key={l.name} className="border-b border-dashed border-ink/15 py-2 last:border-b-0">
                      <div className="flex items-center justify-between gap-2 font-mono text-[0.82rem] text-ink">
                        <span className="flex items-center gap-1.5">
                          {l.name}
                          <AnimatePresence>
                            {stage === 2 && (
                              <motion.span
                                initial={{ scale: 0, rotate: -30 }}
                                animate={{ scale: 1, rotate: i % 2 ? 10 : -8 }}
                                exit={{ scale: 0 }}
                                transition={{ type: "spring", stiffness: 380, damping: 14, delay: i * 0.09 }}
                                className="font-display text-xl leading-none font-bold text-brand italic"
                                aria-hidden="true"
                              >
                                ?
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{l.value}</span>
                          <AnimatePresence>
                            {i < scanned && (
                              <motion.span
                                initial={{ scale: 0.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.4, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 420, damping: 20 }}
                                className={`rounded-full px-2 py-0.5 font-sans text-[0.68rem] font-semibold whitespace-nowrap ${TONE[l.tone]}`}
                              >
                                {l.tag}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                      </div>
                      <AnimatePresence initial={false}>
                        {i < scanned && (
                          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden text-[0.78rem] leading-snug text-muted">
                            {l.note}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </li>
                  ))}
                </ul>
                {/* the scanner line */}
                {stage === 4 && !reduce && (
                  <motion.div
                    className="pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-brand/20 to-brand/50"
                    style={{ top: `calc(${Math.min(1, sub * 1.15) * 100}% - 2.5rem)` }}
                    aria-hidden="true"
                  >
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" />
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* search results pile on top of the slip */}
            <AnimatePresence>
              {stage === 3 && (
                <>
                  <motion.div
                    key="q"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute -top-2 left-1/2 flex w-[92%] -translate-x-1/2 items-center gap-2 rounded-full border border-ink/25 bg-white px-4 py-2.5 text-sm text-ink shadow-[4px_4px_0_rgba(22,19,15,0.12)]"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="9" cy="9" r="5.500" />
                      <path d="M13.500 13.500L17 17" strokeLinecap="round" />
                    </svg>
                    hb 6.5 kya matlab hai
                  </motion.div>
                  {SEARCH_HITS.map((h, i) => (
                    <motion.div
                      key={h.text}
                      initial={{ opacity: 0, scale: 0.6, x: 60, rotate: 0 }}
                      animate={{ opacity: 1, scale: 1, x: 0, rotate: h.r }}
                      exit={{ opacity: 0, scale: 0.6, x: -40 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.12 + i * 0.14 }}
                      className="absolute w-[78%] rounded-xl border border-ink/20 bg-white px-3.5 py-2.5 text-sm font-medium text-ink shadow-[4px_4px_0_rgba(200,30,30,0.25)]"
                      style={{ left: h.x, top: h.y, marginLeft: "18%" }}
                    >
                      <span className="mr-1.5 text-urgent" aria-hidden="true">
                        !
                      </span>
                      {h.text}
                    </motion.div>
                  ))}
                </>
              )}
            </AnimatePresence>

            {/* the rack of tubes */}
            <AnimatePresence>
              {rack && (
                <motion.div key="rack" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.4 }} className="absolute inset-0">
                  {use3D ? (
                    <RackScene filled={Math.min(4, 1 + Math.floor(sub * 5))} />
                  ) : (
                    <ul className="flex h-full flex-col justify-center gap-3">
                      {LINES.map((l) => (
                        <li key={l.name} className="flex items-center justify-between rounded-xl border border-ink/15 bg-white px-4 py-3 font-mono text-sm text-ink">
                          {l.name}
                          <span className={`rounded-full px-2 py-0.5 font-sans text-xs font-semibold ${TONE[l.tone]}`}>{l.tag}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="absolute inset-x-0 -bottom-1 text-center text-sm font-medium text-muted">Normal · High · Urgent · Can&apos;t say</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* chapter dots */}
        <nav className="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col gap-2.5 sm:right-6" aria-label="Story chapters">
          {CHAPTERS.map((ch, i) => (
            <button
              key={ch.eyebrow}
              type="button"
              onClick={() => jump(i)}
              aria-label={`Chapter ${i + 1}: ${ch.eyebrow}`}
              aria-current={i === stage}
              className={`w-2.5 rounded-full transition-all ${i === stage ? "h-7 bg-brand" : i < stage ? "h-2.5 bg-ink" : "h-2.5 bg-ink/25 hover:bg-ink/50"}`}
            />
          ))}
        </nav>
      </div>
    </section>
  );
}
