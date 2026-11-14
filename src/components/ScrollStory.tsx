"use client";

/**
 * The opening story, built to be presented from the website itself.
 * A normal scrolling page: one section per beat of the pitch, each animating
 * as it comes into view, with one shared 3D background behind them.
 */
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import TubeGallery from "./TubeGallery";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const HeroScene = dynamic(() => import("./three/HeroScene"), { ssr: false, loading: () => null });
const RackScene = dynamic(() => import("./three/RackScene"), { ssr: false, loading: () => null });

interface Scene {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  body: string;
}

const SCENES: Scene[] = [
  { id: "number", eyebrow: "Look at this number", title: <>6.0</>, body: "It's on a blood test report. Is it normal? Is it high? Should someone be worried?" },
  { id: "family", eyebrow: "So what do people do?", title: <>They Google it. They ask the family group.</>, body: "And a simple blood test turns into an evening of confusion." },
  { id: "chatbot", eyebrow: "Just ask a chatbot?", title: <>It answers. Confidently.</>, body: "But it doesn't know your lab's ranges, your age or your sex. It guesses, and it sounds sure." },
  { id: "noise", eyebrow: "The data we were given", title: <>96% of every file is noise.</>, body: "Legal disclaimers, compliance logs and boilerplate. The actual results are a few lines buried inside." },
  { id: "traps", eyebrow: "And it has traps", title: <>The files don&apos;t cover everything.</>, body: "A good answer has to know where the files stop, and say so." },
  { id: "me", eyebrow: "Who built this", title: <>I&apos;m Ahmed Malik.</>, body: "I built this solo, with one rule: a medical answer must be right, or it must ask." },
  { id: "idea", eyebrow: "The idea", title: <>Rules decide. AI explains.</>, body: "No language model is allowed to decide if a result is normal, high or urgent. Tested code does that, using the lab's own sheets. The AI only puts it into plain words." },
  { id: "guard", eyebrow: "And we check the AI", title: <>Its words are checked before you see them.</>, body: "A new number, or anything that sounds like a diagnosis, is thrown out. It gets one retry, then a safe built-in answer." },
  { id: "demo", eyebrow: "Enough talking", title: <>Let me show you.</>, body: "Everything below is the live product." },
];

/* ---------------------------------------------------------------- visuals */

function NumberScene({ p }: { p: number }) {
  const reduce = useReducedMotion();
  const chips = ["Normal?", "High?", "Should I worry?", "mmol/L??"];
  return (
    <div className="relative flex h-full items-center justify-center">
      {/* the report slip, with the one line that matters */}
      <div className="w-[88%] -rotate-2 rounded-sm border border-ink/20 bg-white px-5 py-4 font-mono text-[0.82rem] text-ink shadow-[8px_10px_0_rgba(22,19,15,0.12)]">
        <p className="text-[0.66rem] tracking-[0.18em] text-muted uppercase">CityLab Diagnostics · Results</p>
        <div className="mt-2 border-t border-dashed border-ink/25" />
        <p className="mt-2 flex justify-between text-ink/40">
          <span>Hemoglobin</span>
          <span>13.5 g/dL</span>
        </p>
        <p className="mt-1.5 flex justify-between">
          <span>Fasting Blood Sugar</span>
          <span className="font-bold">6.0 mmol/L</span>
        </p>
        <p className="mt-1.5 flex justify-between text-ink/40">
          <span>Cholesterol</span>
          <span>190 mg/dL</span>
        </p>
      </div>
      {/* a magnifying glass that grows over the number as you scroll */}
      <motion.div
        className="pointer-events-none absolute z-10 flex items-center justify-center rounded-full border-[6px] border-ink bg-white shadow-[6px_8px_0_rgba(22,19,15,0.15)]"
        style={{ right: "4%", top: "8%" }}
        animate={{ width: `${(reduce ? 11 : 7 + p * 5).toFixed(2)}rem`, height: `${(reduce ? 11 : 7 + p * 5).toFixed(2)}rem`, rotate: reduce ? 0 : [0, -3, 3, 0] }}
        transition={{ rotate: { duration: 5, repeat: Infinity }, default: { type: "spring", stiffness: 120, damping: 18 } }}
      >
        <span className="font-display leading-none font-semibold text-ink tabular-nums" style={{ fontSize: `${(reduce ? 4.4 : 2.8 + p * 2).toFixed(2)}rem` }}>
          6.0
        </span>
        <span className="absolute -bottom-9 -left-6 h-12 w-3.5 rotate-45 rounded-full bg-ink" aria-hidden="true" />
      </motion.div>
      {chips.map((c, i) => (
        <motion.span
          key={c}
          className="absolute z-20 rounded-full border border-ink/20 bg-white px-3 py-1.5 text-sm font-semibold text-ink shadow-[3px_3px_0_rgba(22,19,15,0.12)]"
          style={{ left: `${[2, 4, 48, 10][i]}%`, top: `${[8, 78, 84, 64][i]}%` }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: p > i * 0.18 ? 1 : 0, scale: p > i * 0.18 ? 1 : 0.5, y: reduce ? 0 : [0, -6, 0] }}
          transition={{ y: { duration: 2.4 + i * 0.3, repeat: Infinity }, default: { type: "spring", stiffness: 300, damping: 18 } }}
        >
          {c}
        </motion.span>
      ))}
    </div>
  );
}

const FAMILY = [
  { who: "Phupho", text: "6 is fine beta, mine was 9 😅", side: "l" },
  { who: "Chachu", text: "Sugar hai. Meetha band karo foran", side: "l" },
  { who: "Cousin", text: "📎 google_result.jpg  'Is 6.0 diabetes??'", side: "l" },
  { who: "You", text: "but is it high or not 😭", side: "r" },
] as const;

function FamilyScene({ p }: { p: number }) {
  const shown = Math.min(FAMILY.length, Math.floor(p * 5.5));
  return (
    <div className="mx-auto flex h-full w-full max-w-sm flex-col overflow-hidden rounded-[1.75rem] border-[6px] border-ink bg-[#efe6dc]">
      <div className="flex items-center gap-2 bg-forest px-4 py-3 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">👪</span>
        <span>
          <span className="block text-sm font-semibold">Khandan ❤️</span>
          <span className="block text-[0.7rem] opacity-80">Phupho, Chachu, Cousin, You</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 p-3">
        <AnimatePresence>
          {FAMILY.slice(0, shown).map((m) => (
            <motion.div
              key={m.text}
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm ${m.side === "r" ? "self-end bg-[#d9fdd3]" : "self-start bg-white"}`}
            >
              {m.side === "l" && <p className="text-[0.7rem] font-bold text-brand">{m.who}</p>}
              <p className="text-ink">{m.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChatbotScene({ p }: { p: number }) {
  const notes = ["Which range? Not your lab's.", "Never asked your age or sex.", "No source. Just confidence."];
  return (
    <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center gap-3">
      <div className="self-end rounded-2xl bg-ink px-4 py-3 text-white">My fasting sugar is 6.0, is that ok?</div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative self-start rounded-2xl border border-ink/15 bg-white px-4 py-3 text-ink">
        <p className="text-[0.7rem] font-bold tracking-wide text-muted uppercase">A general chatbot</p>
        <p className="mt-1">Yes! 6.0 is within the normal range. No need to worry. 😊</p>
        <motion.svg viewBox="0 0 300 60" className="pointer-events-none absolute -inset-x-1 top-6 h-14 w-[calc(100%+0.5rem)]" initial={{ pathLength: 0 }} aria-hidden="true">
          <motion.path d="M6 30 C 80 6, 200 54, 294 28" fill="none" stroke="#c81e1e" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: p > 0.35 ? 1 : 0 }} transition={{ duration: 0.6 }} />
        </motion.svg>
      </motion.div>
      {notes.map((n, i) => (
        <motion.p
          key={n}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: p > 0.45 + i * 0.15 ? 1 : 0, x: p > 0.45 + i * 0.15 ? 0 : 20 }}
          className="font-display self-start text-2xl font-semibold text-urgent italic"
        >
          {n}
        </motion.p>
      ))}
    </div>
  );
}

function NoiseScene({ p }: { p: number }) {
  const rows = 22;
  const keep = new Set([4, 5, 13, 14]);
  const words = Math.round(40425 - (40425 - 1675) * Math.min(1, p * 1.25));
  return (
    <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center">
      <div className="rounded-sm border border-ink/15 bg-white px-5 py-4">
        {Array.from({ length: rows }, (_, i) => {
          const isKeep = keep.has(i);
          const gone = !isKeep && p > (i / rows) * 0.8;
          return (
            <motion.div
              key={i}
              className={`my-1.5 h-2 rounded-full ${isKeep ? "bg-brand" : "bg-ink/15"}`}
              style={{ width: `${isKeep ? 70 : 55 + ((i * 37) % 40)}%` }}
              animate={{ opacity: gone ? 0 : 1, x: gone ? -30 : 0, scaleY: isKeep && p > 0.85 ? 1.6 : 1 }}
              transition={{ duration: 0.35 }}
            />
          );
        })}
      </div>
      <p className="mt-4 text-center font-mono text-sm text-ink">
        <span className="text-2xl font-bold tabular-nums">{words.toLocaleString()}</span> words in the corpus
        {p > 0.8 ? " · the real data, kept" : ""}
      </p>
    </div>
  );
}

const TRAPS = [
  { t: "\"Bob Jones\" is female", d: "Guess sex from a name and you pick the wrong range." },
  { t: "The glucose factor isn't in the files", d: "mmol/L to mg/dL needs ×18. We supply it and say so." },
  { t: "No ranges for children", d: "The sheets stop at 18 to 100. Below that: 'cannot be classified'." },
  { t: "No range for Ferritin or Random Sugar", d: "No range means no verdict. Never an invented one." },
  { t: "No history of the patient", d: "One report alone. So Samjho keeps a history on the device." },
];

function TrapsScene({ p }: { p: number }) {
  return (
    <div className="mx-auto grid h-full w-full max-w-sm content-center gap-2.5">
      {TRAPS.map((t, i) => {
        const on = p > i * 0.17;
        return (
          <motion.div
            key={t.t}
            initial={{ opacity: 0, rotateX: -80 }}
            animate={{ opacity: on ? 1 : 0, rotateX: on ? 0 : -80 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="rounded-xl border-l-4 border-brand bg-white px-4 py-2.5"
            style={{ transformOrigin: "top" }}
          >
            <p className="font-semibold text-ink">{t.t}</p>
            <p className="text-sm text-muted">{t.d}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

function MeScene({ p }: { p: number }) {
  return (
    <div className="relative mx-auto h-full w-full max-w-md">
      <motion.figure
        initial={{ opacity: 0, rotate: -8, y: 30 }}
        animate={{ opacity: 1, rotate: -4, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        className="absolute top-[4%] left-0 w-[78%] bg-white p-2.5 pb-8 shadow-[8px_10px_0_rgba(22,19,15,0.15)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/me/hackathon-win.jpg" alt="Ahmed Malik's team receiving the National Agentic AI Hackathon regional winner cheque" className="aspect-[3/2] w-full object-cover" />
        <figcaption className="font-display absolute bottom-1.5 left-3 text-lg font-semibold text-ink italic">National Agentic AI Hackathon · winner</figcaption>
      </motion.figure>
      <motion.figure
        initial={{ opacity: 0, rotate: 10, y: 40 }}
        animate={{ opacity: p > 0.25 ? 1 : 0, rotate: 5, y: p > 0.25 ? 0 : 40 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        className="absolute right-0 bottom-[4%] w-[62%] bg-white p-2.5 pb-8 shadow-[8px_10px_0_rgba(22,19,15,0.15)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/me/ahmed-speaking.jpg" alt="Ahmed Malik presenting on stage" className="aspect-[3/2] w-full object-cover object-right" />
        <figcaption className="font-display absolute bottom-1.5 left-3 text-lg font-semibold text-ink italic">Ahmed Malik · solo dev</figcaption>
      </motion.figure>
    </div>
  );
}

const PIPE = ["Your report", "Cleaner", "Rules engine", "AI writer", "Guard", "You"];

function IdeaScene({ p, use3D }: { p: number; use3D: boolean }) {
  const lit = Math.min(PIPE.length, Math.floor(p * 7.5) + 1);
  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1">{use3D ? <RackScene filled={Math.min(4, Math.floor(p * 6))} /> : null}</div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 pb-2">
        {PIPE.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <motion.span
              animate={{ backgroundColor: i < lit ? (s === "Rules engine" ? "#e8501f" : "#16130f") : "#ffffff", color: i < lit ? "#ffffff" : "#16130f", scale: i === lit - 1 ? 1.08 : 1 }}
              className="rounded-full border border-ink px-3 py-1.5 text-sm font-semibold"
            >
              {s}
            </motion.span>
            {i < PIPE.length - 1 && <span className="text-ink/40">→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function GuardScene({ p }: { p: number }) {
  const caught = p > 0.3;
  const fixed = p > 0.62;
  return (
    <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center gap-3">
      <p className="text-[0.7rem] font-bold tracking-[0.18em] text-muted uppercase">AI draft</p>
      <div className="rounded-2xl border border-ink/15 bg-white px-4 py-3 text-lg leading-relaxed text-ink">
        <span className={caught ? "rounded bg-urgent/15 text-urgent line-through decoration-2" : ""}>You have diabetes.</span>{" "}
        Normal sugar is <span className={caught ? "rounded bg-urgent/15 text-urgent line-through decoration-2" : ""}>80 to 120</span>.
      </div>
      <AnimatePresence>
        {caught && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-2 text-sm font-semibold">
            <span className="rounded-full bg-urgent px-3 py-1 text-white">✕ diagnosis</span>
            <span className="rounded-full bg-urgent px-3 py-1 text-white">✕ 80 and 120 are not in the results</span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {fixed && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-[0.7rem] font-bold tracking-[0.18em] text-forest uppercase">After the retry · shown to you</p>
            <div className="mt-1.5 rounded-2xl border-2 border-forest bg-white px-4 py-3 text-lg leading-relaxed text-ink">
              Your fasting sugar is 108 mg/dL, above the lab&apos;s range of 70 to 99. Only a doctor can tell what it means for you.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DemoScene() {
  return (
    <div className="flex h-full items-center justify-center">
      <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 1.6, repeat: Infinity }} className="flex flex-col items-center gap-3">
        <span className="font-display text-7xl font-semibold text-brand">↓</span>
        <span className="text-lg font-semibold text-ink">The live app is right below</span>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- page */

/** One beat of the story: a normal page section. Its animation plays as it scrolls into view. */
function SceneBlock({ scene, index, use3D, onStart }: { scene: Scene; index: number; use3D: boolean; onStart: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "center 0.45"] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setP(Math.round(Math.min(1, Math.max(0, v)) * 20) / 20));

  const visual = (() => {
    switch (scene.id) {
      case "number":
        return <NumberScene p={Math.max(p, 0.3)} />;
      case "family":
        return <FamilyScene p={p} />;
      case "chatbot":
        return <ChatbotScene p={p} />;
      case "noise":
        return <NoiseScene p={p} />;
      case "traps":
        return <TrapsScene p={p} />;
      case "me":
        return <MeScene p={p} />;
      case "idea":
        return <IdeaScene p={p} use3D={use3D} />;
      case "guard":
        return <GuardScene p={p} />;
      default:
        return <DemoScene />;
    }
  })();

  const first = index === 0;
  const flip = index % 2 === 1;

  return (
    <section
      ref={ref}
      id={`story-${scene.id}`}
      className={`relative flex items-center ${first ? "min-h-screen pt-16" : "min-h-[88vh] border-t border-ink/10"}`}
      aria-label={scene.eyebrow}
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 py-14 sm:px-8 md:grid-cols-2 md:gap-14">
        <motion.div
          className={flip ? "md:order-2" : ""}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-muted uppercase">
            <span className="tabular-nums text-brand">{String(index + 1).padStart(2, "0")}</span>
            {scene.eyebrow}
          </p>
          <h2 className={`font-display mt-3 leading-[0.98] font-semibold tracking-tight text-ink ${scene.id === "number" ? "text-[5rem] sm:text-[8rem]" : "text-[2.6rem] sm:text-6xl"}`}>{scene.title}</h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink/75 sm:text-xl">{scene.body}</p>
          {first && (
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button type="button" onClick={onStart} className="rounded-full bg-brand px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-dark">
                Skip to my report
              </button>
              <span className="flex items-center gap-3 text-sm font-semibold text-ink">
                <span className="flex h-11 w-7 items-start justify-center rounded-full border-2 border-ink bg-white pt-2" aria-hidden="true">
                  <motion.span className="h-2 w-1.5 rounded-full bg-brand" animate={{ y: [0, 11, 0] }} transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }} />
                </span>
                or scroll for the story
              </span>
            </div>
          )}
          {scene.id === "me" && (
            <div className="mt-6 grid gap-3">
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2 text-base text-white">
                <span aria-hidden="true">🏆</span>
                <strong className="font-bold">4x National Hackathon Winner</strong>
              </p>
              <ul className="grid max-w-md gap-1.5 text-base text-ink/80">
                <li>Founder and lead engineer at Wyibe</li>
                <li>Full-stack, cloud and AI engineer</li>
              </ul>
              <a
                href="https://www.linkedin.com/in/ahhmedmalik"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-ink/25 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-[#0a66c2] hover:text-[#0a66c2]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0a66c2]" fill="currentColor" aria-hidden="true">
                  <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.5c0-1.3-.02-3-1.83-3-1.83 0-2.1 1.43-2.1 2.9V21H9z" />
                </svg>
                Connect on LinkedIn
              </a>
            </div>
          )}
          {scene.id === "demo" && (
            <button type="button" onClick={onStart} className="mt-7 rounded-full bg-brand px-7 py-3.5 text-lg font-semibold text-white transition hover:bg-brand-dark">
              Open the live app
            </button>
          )}
        </motion.div>

        <div className={`relative mx-auto h-[20rem] w-full sm:h-[28rem] ${flip ? "md:order-1" : ""}`}>{visual}</div>
      </div>
    </section>
  );
}

export default function ScrollStory({ use3D, onStart }: { use3D: boolean; onGiveUp3D?: () => void; onStart: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  const ideaAt = SCENES.findIndex((s) => s.id === "idea");

  return (
    <div ref={wrap} className="relative">
      {/* One shared 3D background for the whole story: a single WebGL context that stays pinned while the sections scroll over it. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="sticky top-0 h-screen">
          <div className="hero-static absolute inset-0" />
          {use3D && (
            <div className="absolute inset-0 opacity-60">
              <HeroScene />
            </div>
          )}
          <div className="hero-fade absolute inset-0" />
        </div>
      </div>

      {SCENES.map((scene, i) => (
        <div key={scene.id}>
          <SceneBlock scene={scene} index={i} use3D={use3D} onStart={onStart} />
          {i === ideaAt && <TubeGallery use3D={use3D} />}
        </div>
      ))}

      <div className="fixed inset-x-0 top-0 z-50 h-1" aria-hidden="true">
        <motion.div className="h-full origin-left bg-brand" style={{ scaleX: scrollYProgress }} />
      </div>
    </div>
  );
}
