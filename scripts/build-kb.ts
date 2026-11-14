/**
 * Build-time knowledge base generator.
 *
 * Reads lab_reports/ (read-only), strips the appendix boilerplate, parses the
 * reference sheets into typed tables and writes src/generated/kb.json.
 * Runs before `dev`, `build` and `test`, so the numbers the engine uses are
 * always the numbers in the files. Nothing is typed into code by hand.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleaningStats } from "../src/lib/cleaner";
import { knownTestNames } from "../src/lib/engine";
import { parseReport } from "../src/lib/parser";
import { buildReferenceTables, isReportFile, type CorpusFile } from "../src/lib/reference";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const corpusDir = join(root, "lab_reports");
const outFile = join(root, "src", "generated", "kb.json");

const files: CorpusFile[] = readdirSync(corpusDir)
  .filter((name) => name.toLowerCase().endsWith(".md"))
  .sort()
  .map((name) => ({ name, text: readFileSync(join(corpusDir, name), "utf8") }));

const reference = buildReferenceTables(files);
const knownNames = knownTestNames(reference);

const samples = files
  .filter((f) => isReportFile(f.name))
  .map((f) => {
    const parsed = parseReport(f.text, { knownNames });
    const id = f.name.match(/P\d+/i)?.[0]?.toUpperCase() ?? f.name;
    return {
      id,
      file: f.name,
      label: parsed.patient.name ?? id,
      tests: parsed.tests.map((t) => t.name),
      mrn: parsed.patient.mrn,
      raw: f.text,
    };
  });

let rawChars = 0;
let cleanChars = 0;
for (const f of files) {
  const s = cleaningStats(f.text);
  rawChars += s.rawChars;
  cleanChars += s.cleanChars;
}

const kb = {
  generatedAt: new Date().toISOString(),
  corpus: {
    files: files.map((f) => f.name),
    rawChars,
    cleanChars,
    removedPct: Math.round(((rawChars - cleanChars) / rawChars) * 1000) / 10,
  },
  reference,
  samples,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(kb, null, 1));

console.log(
  `[build-kb] ${files.length} files, ${kb.corpus.removedPct}% boilerplate removed -> ` +
    `${reference.aliases.length} aliases, ${reference.ranges.length} ranges, ` +
    `${reference.urgent.length} urgent thresholds, ${reference.rules.length} rules, ${samples.length} sample reports`,
);

if (reference.ranges.length === 0 || reference.aliases.length === 0 || reference.urgent.length === 0) {
  console.error("[build-kb] reference tables are empty. Check lab_reports/.");
  process.exit(1);
}
