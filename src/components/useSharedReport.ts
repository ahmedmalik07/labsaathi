"use client";

import { useEffect, useState } from "react";

export type SharedReport = { kind: "file"; file: File } | { kind: "text"; text: string; name: string } | { kind: "note"; message: string };

const SHARE_CACHE = "samjho-share-v1";

/**
 * Registers the service worker, and picks up a report shared into Samjho from
 * another app (see public/sw.js). The parked copy is deleted as soon as it is read.
 */
export function useSharedReport(): SharedReport | null {
  const [shared, setShared] = useState<SharedReport | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    const flag = new URLSearchParams(window.location.search).get("shared");
    if (!flag) return;
    window.history.replaceState(null, "", "/#top");

    if (flag !== "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read of the launch URL
      setShared({
        kind: "note",
        message: flag === "retry" ? "Samjho was still setting up on this phone. Please share the report once more." : "That share could not be read. Try sharing the report again, or paste it.",
      });
      return;
    }

    (async () => {
      try {
        const cache = await caches.open(SHARE_CACHE);
        const fileRes = await cache.match("/__shared/file");
        const textRes = await cache.match("/__shared/text");
        if (fileRes) {
          const blob = await fileRes.blob();
          const name = decodeURIComponent(fileRes.headers.get("x-file-name") ?? "shared-report");
          setShared({ kind: "file", file: new File([blob], name, { type: blob.type }) });
        } else if (textRes) {
          setShared({ kind: "text", text: await textRes.text(), name: "Shared text" });
        } else {
          setShared({ kind: "note", message: "Nothing arrived with that share. Try sharing the report again, or paste it." });
        }
        await cache.delete("/__shared/file");
        await cache.delete("/__shared/text");
      } catch {
        setShared({ kind: "note", message: "That share could not be read. Try sharing the report again, or paste it." });
      }
    })();
  }, []);

  return shared;
}
