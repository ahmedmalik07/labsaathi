"use client";

/**
 * 3D test tube for a result card.
 * The liquid level shows where the value sits relative to its range (the two
 * rings mark the low and high limits) and the liquid colour is the status.
 * Urgent tubes pulse.
 */
import { Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const TUBE_H = 2.9;
const TUBE_R = 0.46;
const LIQ_R = 0.39;

interface TubeProps {
  /** 0..1 fill level. The normal range spans 0.25..0.75. */
  level: number;
  color: string;
  urgent: boolean;
  showMarks: boolean;
}

function Bubbles({ color, top }: { color: string; top: number }) {
  const group = useRef<THREE.Group>(null);
  const seeds = useMemo(() => [0.1, 0.45, 0.8].map((p, i) => ({ p, x: (i - 1) * 0.14, z: ((i * 7) % 3) * 0.07 - 0.07, r: 0.035 + i * 0.012 })), []);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const s = seeds[i];
      const y = ((state.clock.elapsedTime * 0.16 + s.p) % 1) * Math.max(0.2, top);
      child.position.set(s.x + Math.sin(state.clock.elapsedTime * 1.4 + i) * 0.03, y, s.z);
      child.visible = top > 0.3;
    });
  });
  return (
    <group ref={group}>
      {seeds.map((s, i) => (
        <mesh key={i}>
          <sphereGeometry args={[s.r, 10, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

export function Tube({ level, color, urgent, showMarks }: TubeProps) {
  const liquid = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const current = useRef(0.02);
  const [top, setTop] = useState(0.1);
  const base = -TUBE_H / 2;
  const tint = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state, delta) => {
    // Ease the liquid up to its level (fills on first paint, glides on re-run).
    current.current += (level - current.current) * (1 - Math.exp(-delta * 2.4));
    const h = Math.max(0.05, current.current * (TUBE_H - 0.15));
    if (liquid.current) {
      liquid.current.scale.y = h;
      liquid.current.position.y = base + 0.05 + h / 2;
    }
    if (cap.current) cap.current.position.y = base + 0.05 + h;
    if (Math.abs(h - top) > 0.05) setTop(h);
    if (material.current) {
      const pulse = urgent ? 0.75 + Math.sin(state.clock.elapsedTime * 5.2) * 0.55 : 0.42;
      material.current.emissiveIntensity = pulse;
    }
    if (group.current) {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.35;
      const s = urgent ? 1 + Math.sin(state.clock.elapsedTime * 5.2) * 0.025 : 1;
      group.current.scale.setScalar(s);
    }
  });

  const markY = (p: number) => base + 0.05 + p * (TUBE_H - 0.15);

  return (
    <group ref={group} rotation={[0, 0, 0.1]}>
      {/* liquid */}
      <mesh ref={liquid} position={[0, base + 0.1, 0]}>
        <cylinderGeometry args={[LIQ_R, LIQ_R, 1, 36, 1, false]} />
        <meshStandardMaterial ref={material} color={tint} emissive={tint} emissiveIntensity={0.42} roughness={0.25} transparent opacity={0.94} />
      </mesh>
      <mesh position={[0, base + 0.05, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[LIQ_R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.42} roughness={0.25} transparent opacity={0.94} />
      </mesh>
      {/* meniscus */}
      <mesh ref={cap} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[LIQ_R, 36]} />
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.9} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>
      <group position={[0, base + 0.05, 0]}>
        <Bubbles color="#ffffff" top={top} />
      </group>

      {/* glass */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[TUBE_R, TUBE_R, TUBE_H, 40, 1, true]} />
        <meshPhysicalMaterial color="#5b6770" transparent opacity={0.2} roughness={0.05} metalness={0.1} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, base + 0.03, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[TUBE_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#5b6770" transparent opacity={0.2} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, TUBE_H / 2 + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TUBE_R + 0.02, 0.045, 12, 48]} />
        <meshStandardMaterial color="#4a545c" transparent opacity={0.7} roughness={0.2} />
      </mesh>

      {/* range limits */}
      {showMarks &&
        [0.25, 0.75].map((p) => (
          <mesh key={p} position={[0, markY(p), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[TUBE_R + 0.015, 0.014, 8, 48]} />
            <meshBasicMaterial color="#16130f" transparent opacity={0.8} />
          </mesh>
        ))}
    </group>
  );
}

export default function TubeScene(props: TubeProps) {
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
        camera={{ position: [0, 0.05, 6.6], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 1, 2]} intensity={0.9} color="#fff1e6" />
        <pointLight position={[0, -1, 2.5]} intensity={props.urgent ? 9 : 4} color={props.color} distance={8} />
        <Float speed={props.urgent ? 3.2 : 1.4} rotationIntensity={0.18} floatIntensity={0.35} floatingRange={[-0.05, 0.05]}>
          <Tube {...props} />
        </Float>
      </Canvas>
    </div>
  );
}
