import type { MetadataRoute } from "next";

/**
 * Installable app manifest. The share_target makes Samjho appear in the phone's
 * share sheet once it is added to the home screen, so a report received on
 * WhatsApp (a photo, a PDF screenshot, or forwarded text) can be sent straight in.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Samjho: your lab report in plain words",
    short_name: "Samjho",
    description: "Explains a lab report against the lab's own range sheets, in English or Roman Urdu.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbeee0",
    theme_color: "#fbeee0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        files: [{ name: "report", accept: ["image/*", "text/plain", "text/markdown", ".md", ".txt"] }],
      },
    },
  } as MetadataRoute.Manifest;
}
