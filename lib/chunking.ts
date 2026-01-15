import { CONFIG } from "./config";

export type Chunk = {
  chunk_index: number;
  char_start: number;
  char_end: number;
  section?: string;
  text: string;
};

function findLastHeading(beforeText: string): string | undefined {
  // Very small heuristic: last markdown heading like "# Title" or "## Section"
  const re = /^#{1,6}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  let last: string | undefined;
  while ((match = re.exec(beforeText)) !== null) {
    last = match[1]?.trim();
  }
  return last;
}

function snapToWhitespace(text: string, idx: number): number {
  if (idx >= text.length) return text.length;
  if (idx <= 0) return 0;
  // Prefer snapping backwards to avoid skipping content
  for (let i = idx; i > Math.max(0, idx - 200); i--) {
    const ch = text[i];
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") return i;
  }
  return idx;
}

export function chunkText(
  input: string,
  opts?: {
    approxTokensPerChunk?: number;
    approxTokensOverlap?: number;
    approxCharsPerToken?: number;
  }
): Chunk[] {
  const approxTokensPerChunk = opts?.approxTokensPerChunk ?? CONFIG.chunking.approxTokensPerChunk;
  const approxTokensOverlap = opts?.approxTokensOverlap ?? CONFIG.chunking.approxTokensOverlap;
  const approxCharsPerToken = opts?.approxCharsPerToken ?? CONFIG.chunking.approxCharsPerToken;

  const text = (input ?? "").replace(/\r\n/g, "\n");
  const chunkChars = Math.max(200, Math.floor(approxTokensPerChunk * approxCharsPerToken));
  const overlapChars = Math.max(0, Math.floor(approxTokensOverlap * approxCharsPerToken));

  const chunks: Chunk[] = [];
  let start = 0;
  let idx = 0;

  while (start < text.length) {
    let end = Math.min(text.length, start + chunkChars);
    end = snapToWhitespace(text, end);

    // Ensure we always make progress
    if (end <= start) end = Math.min(text.length, start + chunkChars);

    const raw = text.slice(start, end);
    const cleaned = raw.trim();
    if (cleaned.length > 0) {
      const section = findLastHeading(text.slice(0, start));
      chunks.push({
        chunk_index: idx,
        char_start: start,
        char_end: end,
        section,
        text: cleaned
      });
      idx += 1;
    }

    if (end >= text.length) break;
    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}
