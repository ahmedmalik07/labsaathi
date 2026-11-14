/**
 * Measures response time and token use per report against a running LabSaathi.
 *
 *   node scripts/measure.mjs https://labsaathi.vercel.app
 *   node scripts/measure.mjs http://localhost:3000 --gap=8000
 *
 * Pass 1 sends every sample report with the LLM explanation on (cold cache).
 * Pass 2 repeats them (served from the cache).
 * Pass 3 sends them with explain:false (rules engine only).
 * The gap between requests keeps the run inside Groq's free-tier tokens-per-minute limit.
 */
import { readdirSync, readFileSync } from "node:fs";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const gap = Number((process.argv.find((a) => a.startsWith("--gap=")) ?? "--gap=6000").split("=")[1]);
const dir = new URL("../lab_reports/", import.meta.url);
const files = readdirSync(dir).filter((f) => /^report_/i.test(f)).sort();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(file, explain) {
  const reportText = readFileSync(new URL(file, dir), "utf8");
  // A connect timeout on a flaky network is not a measurement: try again and time only the attempt that connects.
  for (let attempt = 1; ; attempt++) {
    const started = performance.now();
    try {
      const res = await fetch(`${base}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportText, explain }),
      });
      const json = await res.json();
      return { file, status: res.status, ms: Math.round(performance.now() - started), json };
    } catch (err) {
      if (attempt >= 4) throw err;
      await sleep(1500 * attempt);
    }
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const p95 = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)] : 0;
};

async function pass(label, explain, wait) {
  const rows = [];
  for (const file of files) {
    const r = await call(file, explain);
    const m = r.json.meta ?? {};
    rows.push({
      report: file.match(/P\d+/)?.[0] ?? file,
      http: r.status,
      ms: r.ms,
      engineMs: m.timingsMs?.engine ?? null,
      source: m.explanationSource ?? "error",
      model: m.model ?? "",
      cached: m.cached ?? false,
      promptTok: m.tokens?.prompt ?? 0,
      completionTok: m.tokens?.completion ?? 0,
      guardAttempts: r.json.explanationDetail?.guard?.attempts ?? 0,
    });
    if (wait) await sleep(wait);
  }
  console.log(`\n## ${label}`);
  console.table(rows);
  const ms = rows.map((r) => r.ms);
  const llm = rows.filter((r) => r.source === "llm");
  const prompt = rows.reduce((a, r) => a + r.promptTok, 0);
  const completion = rows.reduce((a, r) => a + r.completionTok, 0);
  console.log(
    `${label}: n=${rows.length}, median ${median(ms)} ms, p95 ${p95(ms)} ms, min ${Math.min(...ms)} ms, max ${Math.max(...ms)} ms, ` +
      `LLM-written ${llm.length}/${rows.length}, tokens prompt ${prompt} + completion ${completion} ` +
      `(avg ${Math.round(prompt / rows.length)} + ${Math.round(completion / rows.length)} per report)`,
  );
  return rows;
}

console.log(`Measuring ${base} with ${files.length} sample reports, ${gap} ms between LLM requests`);
await pass("Pass 1: LLM explanation, cold cache", true, gap);
await pass("Pass 2: same reports again (cache)", true, 0);
await pass("Pass 3: rules engine only (explain:false)", false, 0);
