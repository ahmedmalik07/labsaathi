"use client";

import { createPortal } from "react-dom";
import type { Explanation, Patient, TestResult } from "@/lib/types";
import { STATUS } from "./status";

function rangeCell(r: TestResult): string {
  const range = r.rangeUsed;
  if (!range) return "not in the lab's files";
  if (range.qualitative) return range.qualitative;
  const unit = range.unit ? ` ${range.unit}` : "";
  if (range.low !== null && range.high !== null) return `${range.low} to ${range.high}${unit}`;
  return range.high !== null ? `up to ${range.high}${unit}` : `${range.low}${unit} or more`;
}

/**
 * The printable "Questions for your doctor" sheet. It is mounted directly under
 * <body> and hidden on screen. The print stylesheet hides everything else, so the
 * printout is one clean black-on-white page whichever tab is open.
 */
export default function PrintSheet({ patient, results, explanation, urgentMessage }: { patient: Patient; results: TestResult[]; explanation: Explanation; urgentMessage: string | null }) {
  // Only ever rendered after a client-side analysis, so document is always there.
  if (typeof document === "undefined") return null;

  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return createPortal(
    <div className="print-sheet">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #111827", paddingBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Questions for my doctor</h1>
        <p style={{ fontSize: 12, margin: 0 }}>Samjho · {today}</p>
      </div>

      <p style={{ fontSize: 13, marginTop: 12 }}>
        <strong>Patient:</strong> {patient.name ?? "________________"} &nbsp; <strong>Age:</strong> {patient.age ?? "____"} &nbsp; <strong>Sex:</strong> {patient.sex ?? "________"} &nbsp; <strong>MRN:</strong>{" "}
        {patient.mrn ?? "____________"}
      </p>

      {urgentMessage && <p style={{ fontSize: 14, fontWeight: 700, border: "2px solid #111827", padding: "8px 10px", marginTop: 10 }}>{urgentMessage}</p>}

      <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 18, marginBottom: 6 }}>My results</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {["Test", "My value", "Lab's normal range", "Result", "Source file"].map((h) => (
              <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #111827", padding: "5px 6px" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i}>
              <td style={{ borderBottom: "1px solid #d1d5db", padding: "5px 6px" }}>
                {r.canonicalName}
                {r.canonicalName !== r.originalName ? ` (${r.originalName})` : ""}
              </td>
              <td style={{ borderBottom: "1px solid #d1d5db", padding: "5px 6px" }}>
                {r.rawValue} {r.unit ?? ""}
                {r.conversion ? ` = ${r.conversion.toValue} ${r.conversion.toUnit}` : ""}
              </td>
              <td style={{ borderBottom: "1px solid #d1d5db", padding: "5px 6px" }}>{rangeCell(r)}</td>
              <td style={{ borderBottom: "1px solid #d1d5db", padding: "5px 6px", fontWeight: 700 }}>{STATUS[r.status].label}</td>
              <td style={{ borderBottom: "1px solid #d1d5db", padding: "5px 6px" }}>{r.rangeUsed?.source.file ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 6 }}>Questions to ask</h2>
      <ol style={{ paddingLeft: 20, margin: 0, fontSize: 13.5 }}>
        {explanation.doctorQuestions.map((q) => (
          <li key={q} style={{ marginBottom: 6, breakInside: "avoid" }}>
            {q}
            <div style={{ borderBottom: "1px solid #9ca3af", height: 26 }} />
            <div style={{ borderBottom: "1px solid #9ca3af", height: 26 }} />
          </li>
        ))}
      </ol>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 18, marginBottom: 6 }}>My own notes</h2>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ borderBottom: "1px solid #9ca3af", height: 28 }} />
      ))}

      <p style={{ fontSize: 11.5, marginTop: 18 }}>
        {explanation.disclaimer} Results were labelled by comparing each value with the lab&apos;s own reference sheets. This sheet explains numbers only.
      </p>
    </div>,
    document.body,
  );
}
