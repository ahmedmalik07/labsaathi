"use client";

/**
 * "Take it with you": what a patient can do with the result next.
 * Everything is made in the browser. Nothing is uploaded.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { download, STATUS_WORD, summaryText } from "@/lib/client";
import type { AnalyzeResponse } from "@/lib/pipeline";
import { ReminderMaker } from "./MoreTools";
import { STATUS } from "./status";

type Panel = "qr" | "reminder" | null;

/** Draws a 1080×1350 summary card (a good size for WhatsApp and Instagram). */
async function drawCard(data: AnalyzeResponse): Promise<Blob> {
  const W = 1080;
  const rows = data.results.slice(0, 8);
  const H = Math.max(1080, 420 + rows.length * 110 + (data.urgent ? 140 : 0) + 160);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  await document.fonts?.ready;

  g.fillStyle = "#fbeee0";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#e8501f";
  g.fillRect(0, 0, W, 16);

  // logo
  g.fillStyle = "#e8501f";
  g.beginPath();
  g.roundRect(70, 70, 64, 56, 14);
  g.fill();
  g.fillStyle = "#16130f";
  g.font = "600 52px 'Cormorant Garamond', Georgia, serif";
  g.fillText("Samjho", 152, 116);

  g.font = "600 30px Figtree, Arial, sans-serif";
  g.fillStyle = "#6b625b";
  g.fillText("LAB REPORT SUMMARY", 70, 210);
  g.font = "600 76px 'Cormorant Garamond', Georgia, serif";
  g.fillStyle = "#16130f";
  g.fillText(data.patient.name ?? "Your report", 70, 290);

  let y = 340;
  if (data.urgent) {
    g.fillStyle = "#c81e1e";
    g.beginPath();
    g.roundRect(70, y, W - 140, 110, 24);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "700 46px Figtree, Arial, sans-serif";
    g.fillText("See a doctor today", 110, y + 70);
    y += 140;
  }

  for (const r of rows) {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(70, y, W - 140, 92, 20);
    g.fill();
    g.fillStyle = "#16130f";
    g.font = "600 36px Figtree, Arial, sans-serif";
    g.fillText(r.canonicalName.slice(0, 26), 100, y + 58);
    g.font = "700 36px Figtree, Arial, sans-serif";
    const val = `${r.rawValue} ${r.unit ?? ""}`.trim();
    g.fillText(val, 590, y + 58);
    const word = STATUS_WORD[r.status];
    g.font = "700 26px Figtree, Arial, sans-serif";
    const w = g.measureText(word).width + 36;
    g.fillStyle = STATUS[r.status].color;
    g.beginPath();
    g.roundRect(W - 100 - w, y + 24, w, 46, 23);
    g.fill();
    g.fillStyle = r.status === "low" || r.status === "high" || r.status === "abnormal" || r.status === "unclassified" ? "#16130f" : "#ffffff";
    g.fillText(word, W - 100 - w + 18, y + 56);
    y += 110;
  }
  if (data.results.length > rows.length) {
    g.fillStyle = "#6b625b";
    g.font = "500 28px Figtree, Arial, sans-serif";
    g.fillText(`+ ${data.results.length - rows.length} more on the full report`, 70, y + 20);
    y += 50;
  }

  g.fillStyle = "#6b625b";
  g.font = "500 28px Figtree, Arial, sans-serif";
  g.fillText("Checked against the lab's own range sheets.", 70, H - 110);
  g.fillText("Only a licensed doctor can diagnose.  ·  techfusion.wyibe.com", 70, H - 66);

  return new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
}

export default function TakeAway({ data }: { data: AnalyzeResponse }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const flagged = data.results.filter((r) => !["normal", "unclassified"].includes(r.status)).map((r) => r.canonicalName);

  async function shareImage() {
    setNote(null);
    const blob = await drawCard(data);
    const file = new File([blob], "samjho-summary.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Lab report summary" });
        return;
      } catch {
        /* user closed the share sheet: fall back to download */
      }
    }
    download("samjho-summary.png", blob);
    setNote("Image saved. Send it on WhatsApp or show it to your doctor.");
  }

  async function showQr() {
    setPanel(panel === "qr" ? null : "qr");
    if (!qr) {
      const QR = await import("qrcode");
      setQr(await QR.toDataURL(summaryText(data, 700), { margin: 1, width: 360, color: { dark: "#16130f", light: "#ffffff" } }));
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(summaryText(data, 4000));
      setNote("Summary copied. Paste it anywhere.");
    } catch {
      setNote("Copy is blocked in this browser.");
    }
  }

  const actions: Array<{ label: string; icon: string; onClick: () => void; active?: boolean }> = [
    { label: "Save as image", icon: "🖼️", onClick: shareImage },
    { label: "QR for the doctor", icon: "▦", onClick: showQr, active: panel === "qr" },
    { label: "Retest reminder", icon: "📅", onClick: () => setPanel(panel === "reminder" ? null : "reminder"), active: panel === "reminder" },
    { label: "Copy summary", icon: "📋", onClick: copy },
  ];

  return (
    <section className="rounded-3xl border border-ink/15 bg-white p-5 sm:p-6" aria-label="Take it with you">
      <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">Take it with you</p>
      <h3 className="font-display mt-1 text-3xl font-semibold text-ink">Keep it, share it, bring it to the doctor.</h3>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {actions.map((a) => (
          <motion.button
            key={a.label}
            type="button"
            onClick={a.onClick}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.96 }}
            aria-pressed={a.active}
            className={`flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition ${a.active ? "border-ink bg-ink text-white" : "border-ink/15 bg-cream/40 text-ink hover:border-brand"}`}
          >
            <span className="text-xl" aria-hidden="true">
              {a.icon}
            </span>
            {a.label}
          </motion.button>
        ))}
      </div>
      {note && <p className="mt-3 text-sm text-forest">{note}</p>}
      <AnimatePresence initial={false}>
        {panel === "qr" && (
          <motion.div key="qr" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {qr ? (
                <motion.img initial={{ scale: 0.8, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} src={qr} alt="QR code with the report summary" className="h-48 w-48 rounded-xl border border-ink/15" />
              ) : (
                <div className="skeleton h-48 w-48 rounded-xl" />
              )}
              <p className="max-w-sm text-ink">
                Show this to your doctor. Their phone camera reads the summary straight off your screen. It works offline: the summary is inside the code, not on a server.
              </p>
            </div>
          </motion.div>
        )}
        {panel === "reminder" && (
          <motion.div key="rem" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4">
              <ReminderMaker tests={flagged} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Shown inside the urgent banner: real next steps, not just a warning. */
export function UrgentHelp() {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a href="tel:1122" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-urgent transition hover:scale-[1.03]">
        📞 Call 1122 (Rescue)
      </a>
      <a href="https://www.google.com/maps/search/hospital+near+me" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">
        🏥 Hospitals near me
      </a>
    </div>
  );
}
