"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * A small animated picture for each kind of test, so a card reads at a glance:
 * a red blood cell for hemoglobin, a sugar cube for glucose, a liver for ALT/AST,
 * a droplet for cholesterol, a butterfly-shaped thyroid for TSH, a cup for urine.
 */
type Kind = "rbc" | "wbc" | "platelet" | "sugar" | "liver" | "fat" | "thyroid" | "urine" | "unknown";

export function kindOf(name: string): Kind {
  const n = name.toLowerCase();
  if (/urine|urinalysis/.test(n)) return "urine";
  if (/hemo|haemo|\bhb\b|red blood|rbc/.test(n)) return "rbc";
  if (/white blood|wbc|leuko/.test(n)) return "wbc";
  if (/platelet|plt/.test(n)) return "platelet";
  if (/sugar|glucose|fbs|rbs/.test(n)) return "sugar";
  if (/\balt\b|\bast\b|sgpt|sgot|liver|bilirubin/.test(n)) return "liver";
  if (/cholesterol|ldl|hdl|triglycer|lipid/.test(n)) return "fat";
  if (/tsh|thyro|t3|t4/.test(n)) return "thyroid";
  return "unknown";
}

const LABEL: Record<Kind, string> = {
  rbc: "Red blood cells",
  wbc: "White blood cells",
  platelet: "Platelets",
  sugar: "Blood sugar",
  liver: "Liver",
  fat: "Blood fats",
  thyroid: "Thyroid",
  urine: "Urine",
  unknown: "Other test",
};

function Art({ kind, color }: { kind: Kind; color: string }) {
  switch (kind) {
    case "rbc":
      return (
        <>
          <ellipse cx="24" cy="24" rx="17" ry="15" fill="#d2302f" />
          <ellipse cx="24" cy="24" rx="8" ry="6.500" fill="#9e1b1b" />
          <ellipse cx="18" cy="19" rx="4" ry="2" fill="#fff" opacity="0.35" />
        </>
      );
    case "wbc":
      return (
        <>
          <circle cx="24" cy="24" r="16" fill="#efe7f7" stroke="#8b6fb8" strokeWidth="2" />
          <path d="M17 21c3-6 9-6 11-1 2 4 6 3 5 8-1 4-6 4-8 2-3-3-9 0-8-9z" fill="#8b6fb8" />
        </>
      );
    case "platelet":
      return (
        <>
          <ellipse cx="17" cy="20" rx="8" ry="5" fill="#f59e0b" transform="rotate(-20 17 20)" />
          <ellipse cx="31" cy="18" rx="6" ry="4" fill="#f7b733" transform="rotate(25 31 18)" />
          <ellipse cx="24" cy="31" rx="9" ry="5" fill="#e88a0c" transform="rotate(8 24 31)" />
        </>
      );
    case "sugar":
      return (
        <>
          <path d="M10 18l14-7 14 7v15l-14 7-14-7z" fill="#fffaf3" stroke="#16130f" strokeWidth="1.800" strokeLinejoin="round" />
          <path d="M10 18l14 7 14-7M24 25v15" fill="none" stroke="#16130f" strokeWidth="1.800" strokeLinejoin="round" />
          <circle cx="17" cy="27" r="1.200" fill="#16130f" opacity="0.4" />
          <circle cx="31" cy="29" r="1.200" fill="#16130f" opacity="0.4" />
          <circle cx="24" cy="17" r="1.200" fill="#16130f" opacity="0.4" />
        </>
      );
    case "liver":
      return <path d="M7 22c2-8 13-11 23-9 8 1 12 5 11 10-1 7-9 6-13 10-4 3-9 6-14 3C8 34 6 28 7 22z" fill="#a0442c" />;
    case "fat":
      return (
        <>
          <path d="M24 6c6 9 12 15 12 22a12 12 0 01-24 0c0-7 6-13 12-22z" fill="#ffb703" />
          <ellipse cx="20" cy="28" rx="3" ry="5" fill="#fff" opacity="0.4" />
        </>
      );
    case "thyroid":
      return (
        <>
          <path d="M23 24c-2-9-12-13-15-6-3 8 4 16 11 14 3-1 4-4 4-8z" fill={color} opacity="0.85" />
          <path d="M25 24c2-9 12-13 15-6 3 8-4 16-11 14-3-1-4-4-4-8z" fill={color} opacity="0.85" />
          <rect x="21" y="20" width="6" height="8" rx="3" fill={color} />
        </>
      );
    case "urine":
      return (
        <>
          <path d="M13 12h22l-3 26a3 3 0 01-3 3H19a3 3 0 01-3-3z" fill="#fffaf3" stroke="#16130f" strokeWidth="1.800" strokeLinejoin="round" />
          <path d="M15 24h18l-1.600 14a2 2 0 01-2 1.800H18.600a2 2 0 01-2-1.800z" fill="#f2c94c" />
        </>
      );
    default:
      return (
        <>
          <circle cx="24" cy="24" r="16" fill="#fffaf3" stroke="#16130f" strokeWidth="1.800" strokeDasharray="3 3" />
          <text x="24" y="30" textAnchor="middle" fontSize="16" fontWeight="700" fill="#16130f">
            ?
          </text>
        </>
      );
  }
}

export default function TestIcon({ name, color, urgent }: { name: string; color: string; urgent?: boolean }) {
  const kind = kindOf(name);
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cream"
      title={LABEL[kind]}
      initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
      animate={reduce ? { scale: 1, rotate: 0, opacity: 1 } : { scale: urgent ? [1, 1.12, 1] : 1, rotate: [0, -4, 4, 0], opacity: 1, y: [0, -2, 0] }}
      transition={reduce ? { duration: 0.2 } : { duration: urgent ? 1.1 : 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 48 48" className="h-9 w-9" role="img" aria-label={LABEL[kind]}>
        <Art kind={kind} color={color} />
      </svg>
    </motion.span>
  );
}
