"use client";

/**
 * Hero background: slowly drifting red blood cells.
 * One instanced mesh of biconcave discs, depth fog, gentle pointer parallax.
 * Loaded with next/dynamic and ssr: false, so it can never block the page.
 */
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/** Profile of a red blood cell (Evans and Fung shape), revolved around the Y axis. */
function useCellGeometry() {
  return useMemo(() => {
    const half = (r: number) => 0.5 * Math.sqrt(Math.max(0, 1 - r * r)) * (0.207 + 2.003 * r * r - 1.123 * r ** 4);
    const pts: THREE.Vector2[] = [];
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const r = i / steps;
      pts.push(new THREE.Vector2(r, half(r)));
    }
    for (let i = steps - 1; i >= 0; i--) {
      const r = i / steps;
      pts.push(new THREE.Vector2(r, -half(r)));
    }
    const geo = new THREE.LatheGeometry(pts, 40);
    geo.computeVertexNormals();
    return geo;
  }, []);
}

interface Cell {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  spin: THREE.Vector3;
  drift: THREE.Vector3;
  scale: number;
  phase: number;
}

const BOUNDS = { x: 13, y: 7.5, zNear: 1.5, zFar: -20 };

function Cells({ count }: { count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useCellGeometry();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const cells = useMemo<Cell[]>(() => {
    // Deterministic pseudo-random layout so the scene looks the same on every load.
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: count }, () => ({
      position: new THREE.Vector3((rand() - 0.5) * 2 * BOUNDS.x, (rand() - 0.5) * 2 * BOUNDS.y, BOUNDS.zFar + rand() * (BOUNDS.zNear - BOUNDS.zFar)),
      rotation: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
      spin: new THREE.Vector3((rand() - 0.5) * 0.22, (rand() - 0.5) * 0.22, (rand() - 0.5) * 0.16),
      drift: new THREE.Vector3(0.1 + rand() * 0.22, (rand() - 0.5) * 0.07, (rand() - 0.5) * 0.05),
      scale: 0.42 + rand() * 0.62,
      phase: rand() * Math.PI * 2,
    }));
  }, [count]);

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      c.position.x += c.drift.x * dt;
      c.position.y += (c.drift.y + Math.sin(t * 0.35 + c.phase) * 0.05) * dt;
      c.position.z += c.drift.z * dt;
      if (c.position.x > BOUNDS.x) c.position.x = -BOUNDS.x;
      if (c.position.y > BOUNDS.y) c.position.y = -BOUNDS.y;
      if (c.position.y < -BOUNDS.y) c.position.y = BOUNDS.y;
      c.rotation.x += c.spin.x * dt;
      c.rotation.y += c.spin.y * dt;
      c.rotation.z += c.spin.z * dt;
      dummy.position.copy(c.position);
      dummy.rotation.copy(c.rotation);
      dummy.scale.setScalar(c.scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#d2302f" emissive="#7a1410" emissiveIntensity={0.35} roughness={0.45} metalness={0.02} />
    </instancedMesh>
  );
}

/** Moves the camera a little towards the pointer. Eased, so it never jumps. */
function Parallax() {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 1.6);
    camera.position.x += (target.current.x * 0.9 - camera.position.x) * k;
    camera.position.y += (-target.current.y * 0.55 - camera.position.y) * k;
    camera.lookAt(0, 0, -6);
  });
  return null;
}

export default function HeroScene({ onGiveUp }: { onGiveUp?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [count] = useState(() => (typeof window !== "undefined" && window.innerWidth < 720 ? 26 : 54));

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden="true">
      <Canvas
        frameloop={inView ? "always" : "never"}
        dpr={[1, 1.6]}
        camera={{ position: [0, 0, 9], fov: 48, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <fog attach="fog" args={["#fbeee0", 6, 24]} />
        <ambientLight intensity={1.25} color="#fff1e6" />
        <directionalLight position={[6, 8, 6]} intensity={2.1} color="#ffd9df" />
        <directionalLight position={[-8, -3, 2]} intensity={0.9} color="#ffd9c7" />
        <pointLight position={[0, 0, 5]} intensity={22} distance={22} color="#ff5b7f" />
        <Cells count={count} />
        <Parallax />
        <AdaptiveDpr pixelated={false} />
        {/* If the device cannot keep up, hand control back so the page shows the static gradient. */}
        <PerformanceMonitor flipflops={3} onFallback={() => onGiveUp?.()} />
      </Canvas>
    </div>
  );
}
