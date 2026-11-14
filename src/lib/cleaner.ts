/**
 * Cleaner.
 * Every corpus file is ~95% repeated boilerplate under "### APPENDIX" headings.
 * We drop each appendix: from its heading up to the next "## " heading or the
 * end of the file. Line numbers of the surviving lines are preserved so that
 * citations ("file:line") always point at the original file.
 */

export interface CleanLine {
  /** 1-based line number in the original file. */
  line: number;
  text: string;
}

const APPENDIX_HEADING = /^\s{0,3}#{3}\s+APPENDIX\b/i;
const SECTION_HEADING = /^\s{0,3}#{1,2}\s+\S/;

export function cleanLines(raw: string): CleanLine[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const kept: CleanLine[] = [];
  let skipping = false;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (APPENDIX_HEADING.test(text)) {
      skipping = true;
      continue;
    }
    if (skipping && SECTION_HEADING.test(text)) skipping = false;
    if (!skipping) kept.push({ line: i + 1, text });
  }
  return kept;
}

export function cleanText(raw: string): string {
  return cleanLines(raw)
    .map((l) => l.text)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleaningStats(raw: string): { rawChars: number; cleanChars: number; removedPct: number } {
  const rawChars = raw.length;
  const cleanChars = cleanText(raw).length;
  const removedPct = rawChars === 0 ? 0 : Math.round(((rawChars - cleanChars) / rawChars) * 1000) / 10;
  return { rawChars, cleanChars, removedPct };
}
