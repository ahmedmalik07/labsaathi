"use client";

/**
 * A rack of four test tubes for the scroll story. One WebGL canvas.
 * The tubes fill one after another as the reader scrolls (`filled` = how many).
 */
import { Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Tube } from "./TubeScene";

const TUBES = [
  { level: 0.5, color: "#0b7a68", urgent: false, marks: true },
  { level: 0.86, color: "#f59e0b", urgent: false, marks: true },
  { level: 0.1, color: "#c81e1e", urgent: true, marks: true },
  { level: 0.5, color: "#8a8079", urgent: false, marks: false },
];

/** The whole rack leans gently towards the pointer. */
function Lean({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.exp(-delta * 3);
    g.rotation.y += (state.pointer.x * 0.35 - g.rotation.y) * k;
    g.rotation.x += (-state.pointer.y * 0.12 - g.rotation.x) * k;
  });
  return <group ref={group}>{children}</group>;
}

export default function RackScene({ filled }: { filled: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="h-full w-full" aria-hidden="true">
      <Canvas
        frameloop={inView ? "always" : "never"}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.2, 7.4], fov: 34 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 1, 2]} intensity={0.9} color="#fff1e6" />
        <Lean>
          {TUBES.map((t, i) => (
            <group key={i} position={[(i - 1.5) * 1.35, 0, 0]}>
              <Float speed={1.2 + i * 0.25} rotationIntensity={0.12} floatIntensity={0.3} floatingRange={[-0.06, 0.06]}>
                <Tube level={i < filled ? t.level : 0.02} color={t.color} urgent={t.urgent && i < filled} showMarks={t.marks} />
              </Float>
            </group>
          ))}
          {/* the rack bar */}
          <mesh position={[0, -1.72, 0]}>
            <boxGeometry args={[5.9, 0.16, 1.1]} />
            <meshStandardMaterial color="#16130f" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[5.9, 0.07, 0.16]} />
            <meshStandardMaterial color="#16130f" roughness={0.6} />
          </mesh>
        </Lean>
      </Canvas>
    </div>
  );
}
