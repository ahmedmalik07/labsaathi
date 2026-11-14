"use client";

import { useEffect, useState } from "react";

/**
 * Decides whether 3D may run. It starts as false, so the first paint is always
 * the static version and the page is usable before any WebGL code loads.
 *
 * 3D stays on for reduced-motion users (the scenes are slow and calm), and is
 * only switched off when the browser has no WebGL or the user asked to save data.
 * Add ?3d=0 to the URL to force it off, ?3d=1 to force it on.
 */
export function useThreeD(): { enabled: boolean; reason: string; disable: () => void } {
  const [state, setState] = useState<{ enabled: boolean; reason: string }>({ enabled: false, reason: "loading" });

  useEffect(() => {
    const force = new URLSearchParams(window.location.search).get("3d");
    const decide = () => {
      if (force === "0") return { enabled: false, reason: "turned off with ?3d=0" };
      if (force === "1") return { enabled: true, reason: "forced on with ?3d=1" };
      const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
      if (nav.connection?.saveData) return { enabled: false, reason: "data saver is on" };
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!gl) return { enabled: false, reason: "WebGL is not available" };
      } catch {
        return { enabled: false, reason: "WebGL is not available" };
      }
      return { enabled: true, reason: "ok" };
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check after mount
    setState(decide());
  }, []);

  // A slow frame rate no longer switches 3D off: the scenes lower their own resolution instead.
  return { ...state, disable: () => undefined };
}
