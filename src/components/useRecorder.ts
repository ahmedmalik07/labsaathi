"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Records a short voice question with the browser's MediaRecorder. Nothing is kept after it is sent. */
export function useRecorder(maxSeconds = 30) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const resolver = useRef<((b: Blob | null) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after mount
    setSupported(typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const cleanup = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    recorder.current = null;
    setRecording(false);
  };

  const stop = useCallback((): Promise<Blob | null> => {
    const r = recorder.current;
    if (!r || r.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      resolver.current = resolve;
      r.stop();
    });
  }, []);

  const start = useCallback(async (): Promise<string | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      r.onstop = () => {
        const blob = chunks.current.length ? new Blob(chunks.current, { type: r.mimeType || "audio/webm" }) : null;
        cleanup();
        resolver.current?.(blob);
        resolver.current = null;
      };
      recorder.current = r;
      r.start();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= maxSeconds) void stop();
          return s + 1;
        });
      }, 1000);
      return null;
    } catch {
      cleanup();
      return "Microphone access was blocked. Allow it in the browser, or type your question.";
    }
  }, [maxSeconds, stop]);

  useEffect(() => () => cleanup(), []);

  return { supported, recording, seconds, start, stop };
}
