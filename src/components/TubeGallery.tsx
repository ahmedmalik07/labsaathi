"use client";

/**
 * Nine kinds of answer, nine test tubes. Every case is one the rules engine
 * really produces from the lab's files. All nine tubes share ONE WebGL canvas
 * (drei <View>), so the page never runs out of browser 3D contexts.
 */
import { Float, PerspectiveCamera, View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useRef } from "react";
import { TubeFallback } from "./TestTube";
import { Tube } from "./three/TubeScene";

interface Case {
  title: string;
  test: string;
  value: string;
  verdict: string;
  pill: string;
  color: string;
  level: number;
  marks: boolean;
  urgent?: boolean;
  why: string;
}

const CASES: Case[] = [
  { title: "Normal", test: "Hemoglobin", value: "13.5 g/dL", verdict: "Normal", pill: "bg-forest text-white", color: "#0b7a68", level: 0.48, marks: true, why: "Inside 12.1 to 15.1, the range for a woman of 28." },
  { title: "On the limit", test: "SGPT (ALT)", value: "45 U/L", verdict: "Normal", pill: "bg-forest text-white", color: "#0b7a68", level: 0.75, marks: true, why: "Exactly on the female limit of 45. The lab's rule: on the limit is normal." },
  { title: "Low", test: "Platelets", value: "120,000 /mcL", verdict: "Low", pill: "bg-sun text-ink", color: "#f59e0b", level: 0.15, marks: true, why: "Below 150,000. Worth asking the doctor, not an emergency." },
  { title: "High", test: "White cells", value: "12,000 /mcL", verdict: "High", pill: "bg-sun text-ink", color: "#f59e0b", level: 0.86, marks: true, why: "Above 11,000, the top of the lab's range." },
  { title: "Converted first", test: "Fasting sugar", value: "6.0 mmol/L", verdict: "High · 108 mg/dL", pill: "bg-sun text-ink", color: "#f59e0b", level: 0.9, marks: true, why: "Converted to mg/dL before comparing, and the sum is shown." },
  { title: "Urgent, low", test: "Hemoglobin", value: "6.5 g/dL", verdict: "See a doctor today", pill: "bg-urgent text-white", color: "#c81e1e", level: 0.06, marks: true, urgent: true, why: "Below the lab's urgent limit of 7.0." },
  { title: "Urgent, high", test: "Fasting sugar", value: "350 mg/dL", verdict: "See a doctor today", pill: "bg-urgent text-white", color: "#c81e1e", level: 0.97, marks: true, urgent: true, why: "Past the urgent limit of 300. Warned, never diagnosed." },
  { title: "Needs your answer", test: "AST", value: "44 U/L", verdict: "Asks: male or female?", pill: "bg-info text-white", color: "#3b5bdb", level: 0.5, marks: false, why: "Normal for a man, high for a woman. Sex is missing, so it asks." },
  { title: "Can't say", test: "Serum Ferritin", value: "25 ng/mL", verdict: "Cannot be classified", pill: "bg-white text-ink border border-ink/40", color: "#8a8079", level: 0.5, marks: false, why: "No range in the lab's sheets. It won't invent one." },
];

export default function TubeGallery({ use3D }: { use3D: boolean }) {
  const container = useRef<HTMLDivElement>(null!);

  return (
    <section className="relative border-t border-ink/10" aria-label="Every kind of answer">
      <div ref={container} className="relative mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">What the rules can say</p>
        <h2 className="font-display mt-2 max-w-3xl text-5xl leading-[1.02] font-semibold text-ink sm:text-6xl">Nine kinds of answer. One tube each.</h2>
        <p className="mt-3 max-w-2xl text-lg text-muted">The liquid shows where the value sits. The two rings are the lab&apos;s low and high limits. The colour is the verdict.</p>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map((c, i) => (
            <motion.li
              key={c.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: (i % 3) * 0.1, type: "spring", stiffness: 180, damping: 22 }}
              className={`flex items-center gap-4 rounded-3xl border bg-white p-4 ${c.urgent ? "border-urgent" : "border-ink/15"}`}
            >
              <div className={`relative h-40 w-20 shrink-0 ${c.urgent ? "urgent-pulse rounded-[2.5rem]" : ""}`}>
                {use3D ? (
                  <View className="absolute inset-0">
                    {/* Each tube gets its own camera framed to its own box, so it sits fully inside the card. */}
                    <PerspectiveCamera makeDefault position={[0, 0, 7.2]} fov={30} />
                    <ambientLight intensity={1.5} />
                    <directionalLight position={[3, 4, 5]} intensity={2.2} />
                    <directionalLight position={[-4, 1, 2]} intensity={0.9} color="#fff1e6" />
                    <pointLight position={[0, -1, 2.5]} intensity={c.urgent ? 9 : 4} color={c.color} distance={8} />
                    <Float speed={c.urgent ? 3 : 1.3} rotationIntensity={0.1} floatIntensity={0.2} floatingRange={[-0.04, 0.04]}>
                      <group position={[0, 0.05, 0]}>
                      <Tube level={c.level} color={c.color} urgent={!!c.urgent} showMarks={c.marks} />
                      </group>
                    </Float>
                  </View>
                ) : (
                  <TubeFallback level={c.level} color={c.color} urgent={!!c.urgent} showMarks={c.marks} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-[0.16em] text-muted uppercase">{c.title}</p>
                <p className="font-display mt-1 text-2xl leading-tight font-semibold text-ink">{c.test}</p>
                <p className="mt-0.5 text-lg font-bold text-ink tabular-nums">{c.value}</p>
                <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.pill}`}>{c.verdict}</span>
                <p className="mt-1.5 text-sm leading-snug text-muted">{c.why}</p>
              </div>
            </motion.li>
          ))}
        </ul>

        {use3D && (
          <Canvas
            eventSource={container}
            className="pointer-events-none"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            camera={{ position: [0, 0.15, 5.6], fov: 34 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          >
            <View.Port />
          </Canvas>
        )}
      </div>
    </section>
  );
}
