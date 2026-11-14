"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Read-aloud with the browser's Web Speech API. Nothing is sent to a server.
 * Long text is spoken sentence by sentence, because some browsers cut off a
 * single long utterance after a few seconds.
 */
export function useSpeech() {
  // Only used in views that render after a client-side analysis, so reading window here is safe.
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
  const [speaking, setSpeaking] = useState(false);
  const token = useRef(0);

  useEffect(() => {
    if (!supported) return;
    // Voices load asynchronously in Chrome. Touching the list starts that.
    window.speechSynthesis.getVoices();
    return () => {
      // token is a plain counter, not a DOM ref: bumping it on unmount cancels any queued sentence.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      token.current++;
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    token.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string, lang: "en" | "roman-urdu") => {
      if (!supported || !text.trim()) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const run = ++token.current;

      const voices = synth.getVoices();
      // Roman Urdu has no voice of its own. An Urdu, Hindi or South Asian English
      // voice pronounces it far better than a US or UK English one.
      const wanted = lang === "roman-urdu" ? ["ur", "hi", "en-in", "en-pk", "en"] : ["en-us", "en-gb", "en"];
      const voice = wanted.map((p) => voices.find((v) => v.lang.toLowerCase().startsWith(p))).find(Boolean) ?? null;

      const sentences = text
        .replace(/\s+/g, " ")
        .split(/(?<=[.?!])\s+/)
        .filter(Boolean);

      let i = 0;
      const next = () => {
        if (run !== token.current) return;
        if (i >= sentences.length) {
          setSpeaking(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(sentences[i++]);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        } else {
          u.lang = lang === "roman-urdu" ? "hi-IN" : "en-US";
        }
        u.rate = lang === "roman-urdu" ? 0.9 : 0.95;
        u.onend = next;
        u.onerror = () => {
          if (run === token.current) setSpeaking(false);
        };
        synth.speak(u);
      };
      setSpeaking(true);
      next();
    },
    [supported],
  );

  return { supported, speaking, speak, stop };
}
