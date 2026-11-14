"use client";

import dynamic from "next/dynamic";

/** SVG tube: first paint, reduced motion, weak devices, and cards beyond the 3D budget. */
export function TubeFallback({ level, color, urgent, showMarks }: { level: number; color: string; urgent: boolean; showMarks: boolean }) {
  const top = 14;
  const bottom = 150;
  const fillTop = bottom - (bottom - top) * Math.min(0.97, Math.max(0.04, level));
  const mark = (p: number) => bottom - (bottom - top) * p;
  const id = `liq-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 64 168" className="h-full w-full" role="img" aria-label={`Level ${Math.round(level * 100)} percent`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d="M18 8 H46 V136 A14 14 0 0 1 18 136 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="18" y={fillTop} width="28" height={bottom - fillTop + 8} fill={`url(#${id})`} className={urgent ? "liquid-urgent" : undefined} />
        <rect x="18" y={fillTop} width="28" height="2.5" fill="#ffffff" opacity="0.55" />
      </g>
      <path d="M18 8 H46 V136 A14 14 0 0 1 18 136 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(226,240,255,0.55)" strokeWidth="1.6" />
      <rect x="14" y="4" width="36" height="6" rx="3" fill="rgba(226,240,255,0.5)" />
      <rect x="22" y="16" width="3" height="104" rx="1.5" fill="#ffffff" opacity="0.18" />
      {showMarks &&
        [0.25, 0.75].map((p) => (
          <g key={p}>
            <line x1="14" x2="50" y1={mark(p)} y2={mark(p)} stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.2" strokeDasharray="3 2" />
          </g>
        ))}
    </svg>
  );
}

const TubeScene = dynamic(() => import("./three/TubeScene"), {
  ssr: false,
  loading: () => null,
});

export interface TestTubeProps {
  /** 0..1, null when there is no numeric range to place the value in. */
  position: number | null;
  color: string;
  urgent: boolean;
  use3D: boolean;
}

export default function TestTube({ position, color, urgent, use3D }: TestTubeProps) {
  const level = position ?? 0.5;
  const showMarks = position !== null;
  return (
    <div className={`relative h-44 w-20 shrink-0 sm:h-48 sm:w-24 ${urgent ? "urgent-pulse rounded-[2.75rem]" : ""}`}>
      {use3D ? (
        <>
          {/* The SVG sits underneath until the WebGL canvas has painted over it. */}
          <div className="absolute inset-0 opacity-0">
            <TubeFallback level={level} color={color} urgent={urgent} showMarks={showMarks} />
          </div>
          <div className="absolute inset-0">
            <TubeScene level={level} color={color} urgent={urgent} showMarks={showMarks} />
          </div>
        </>
      ) : (
        <TubeFallback level={level} color={color} urgent={urgent} showMarks={showMarks} />
      )}
    </div>
  );
}
