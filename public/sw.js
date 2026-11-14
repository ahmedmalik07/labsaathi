/*
 * Samjho service worker. It has one job: receive a report shared from another
 * app (WhatsApp, Gallery, Files) through the Web Share Target API.
 *
 * The shared file or text is parked in a private cache on this device, and the
 * page is opened with ?shared=1. The page reads it, deletes it, and runs it
 * through the normal flow. Nothing is uploaded at this step.
 */
const SHARE_CACHE = "samjho-share-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== "/share-target") return;

  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const cache = await caches.open(SHARE_CACHE);
        await cache.delete("/__shared/file");
        await cache.delete("/__shared/text");

        const file = form.getAll("report").find((f) => f && typeof f !== "string");
        if (file) {
          await cache.put(
            "/__shared/file",
            new Response(file, { headers: { "content-type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name || "shared-report") } }),
          );
        }
        const text = [form.get("title"), form.get("text")].filter((v) => typeof v === "string" && v.trim()).join("\n");
        if (text) await cache.put("/__shared/text", new Response(text, { headers: { "content-type": "text/plain" } }));

        return Response.redirect("/?shared=1#top", 303);
      } catch {
        return Response.redirect("/?shared=failed#top", 303);
      }
    })(),
  );
});
