/** Samjho mark: a speech bubble (someone explaining) holding a half-full test tube. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Samjho logo">
      <path d="M8 3h24a7 7 0 0 1 7 7v15a7 7 0 0 1-7 7H17l-8.2 6.2A1 1 0 0 1 7.200 37.400V32A7 7 0 0 1 1 25V10a7 7 0 0 1 7-7z" fill="#e8501f" />
      <path d="M15.500 9h9M17 9v13.500a3 3 0 0 0 6 0V9" fill="none" stroke="#fffaf3" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 17h6v5.500a3 3 0 0 1-6 0z" fill="#fffaf3" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[1.45rem] leading-none sm:text-[1.7rem] font-semibold tracking-tight text-ink">Samjho</span>
    </span>
  );
}
