"use client";

import { useEffect, useState } from "react";

/**
 * Decides whether 3D may run. It starts as false, so the first paint is always
 * the static version and the page is usable before any WebGL code loads.
 * 3D stays off for prefers-reduced-motion, data-saver, weak devices and
 * browsers without WebGL.
 */
export function useThreeD(): { enabled: boolean; reason: string; disable: () => void } {
  const [state, setState] = useState<{ enabled: boolean; reason: string }>({ enabled: false, reason: "loading" });

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => {
      if (reduce.matches) return { enabled: false, reason: "reduced motion is on" };
      const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
      if (nav.connection?.saveData) return { enabled: false, reason: "data saver is on" };
      if ((nav.hardwareConcurrency ?? 8) <= 2) return { enabled: false, reason: "low-power device" };
      if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return { enabled: false, reason: "low-memory device" };
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!gl) return { enabled: false, reason: "WebGL is not available" };
      } catch {
        return { enabled: false, reason: "WebGL is not available" };
      }
      return { enabled: true, reason: "ok" };
    };
    const apply = () => setState(decide());
    apply();
    reduce.addEventListener("change", apply);
    return () => reduce.removeEventListener("change", apply);
  }, []);

  return { ...state, disable: () => setState({ enabled: false, reason: "the device could not keep a smooth frame rate" }) };
}
