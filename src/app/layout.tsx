import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Figtree } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], display: "swap" });
const text = Figtree({ variable: "--font-text", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Samjho · your lab report in plain words",
  description:
    "Samjho checks every value on a lab report against the lab's own reference sheets and explains it in plain English or Roman Urdu. It never guesses and never diagnoses.",
};

export const viewport: Viewport = {
  themeColor: "#fbeee0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
