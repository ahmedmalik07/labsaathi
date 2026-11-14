"use client";

import { useEffect, useState } from "react";

const KEY = "samjho.easyRead";

/** "Aa" button: bigger text and stronger contrast for older eyes. Remembered on this device. */
export default function EasyRead() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let saved = false;
    try {
      saved = window.localStorage.getItem(KEY) === "1";
    } catch {
      /* storage blocked */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved preference after mount
    setOn(saved);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("easy-read", on);
    try {
      window.localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* storage blocked */
    }
  }, [on]);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      title={on ? "Normal text size" : "Bigger, easier text"}
      aria-label={on ? "Switch to normal text size" : "Switch to bigger, easier text"}
      className={`font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold transition ${on ? "bg-ink text-white" : "bg-white text-ink hover:text-brand"}`}
    >
      Aa
    </button>
  );
}
