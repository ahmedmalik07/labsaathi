import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const display = Sora({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const text = Inter({ variable: "--font-text", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "LabSaathi: your lab report in plain words",
  description:
    "LabSaathi checks every value on a lab report against the lab's own reference sheets and explains it in plain English or Roman Urdu. It never guesses and never diagnoses.",
};

export const viewport: Viewport = {
  themeColor: "#050816",
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
