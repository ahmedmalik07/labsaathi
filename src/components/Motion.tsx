"use client";

/** Small motion helpers shared by the cards. They all switch off for reduced motion. */
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** A card that tilts a little towards the pointer and lifts on hover. */
export function Tilt({ children, className = "", max = 5 }: { children: React.ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-max, max]), { stiffness: 200, damping: 20 });

  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      whileHover={{ y: -4 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Counts up to a number the first time it is shown. After that it simply shows
 * the current value, so a value that changes later (the "what if" slider) is
 * never stale. Text values are shown as they are.
 */
export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  const target = Number(value.replace(/,/g, ""));
  const decimals = (value.split(".")[1] ?? "").length;
  const useCommas = value.includes(",");
  const [shown, setShown] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (reduce || started.current || !Number.isFinite(target)) return;
    started.current = true;
    const controls = animate(0, target, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        const fixed = v.toFixed(decimals);
        setShown(useCommas ? Number(fixed).toLocaleString("en-US", { minimumFractionDigits: decimals }) : fixed);
      },
      onComplete: () => setShown(null),
    });
    return () => {
      controls.stop();
      setShown(null);
    };
  }, [reduce, target, decimals, useCommas]);

  return <span className={className}>{shown ?? value}</span>;
}
