import Groq from "groq-sdk";
import { CONFIG } from "./config";

// Groq client
const groq = new Groq({ apiKey: CONFIG.groq.apiKey });

// Lazy-load embedder so it stays server-only and loads once
let embedderPromise: Promise<any> | null = null;

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    })();
  }
  return embedderPromise;
}

/**
 * FREE local embeddings (384-dim)
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = await getEmbedder();

  const embeddings: number[][] = [];
  for (const text of texts) {
    const output = await model(text, { pooling: "mean", normalize: true });
    embeddings.push(Array.from(output.data as Iterable<number>));
  }
  return embeddings;
}

/**
 * Chat + citations via Groq
 */
export async function answerWithCitations(opts: {
  question: string;
  sources: Array<{ n: number; text: string; title?: string; section?: string; chunk_index: number }>;
}): Promise<{
  answer: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}> {
  const sourcesBlock = opts.sources
    .map((s) => {
      const header = `[${s.n}] ${s.title ?? "Untitled"}${s.section ? ` — ${s.section}` : ""} (chunk ${s.chunk_index})`;
      return `${header}\n${s.text}`;
    })
    .join("\n\n");

  // Stronger instructions to reduce false "I don't know"
  const system = [
    "You are a grounded assistant.",
    "You MUST answer using ONLY the sources provided.",
    "If the answer is explicitly present in the sources, you MUST provide it.",
    "Use citations like [1] or [1][2] that refer to the numbered sources.",
    "If none of the sources contain the answer, reply: I don't know based on the document."
  ].join(" ");

  const user = `QUESTION:\n${opts.question}\n\nSOURCES:\n${sourcesBlock}\n\nANSWER (with citations):`;

  const completion = await groq.chat.completions.create({
    model: CONFIG.groq.chatModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0,
    max_tokens: 300
  });

  const answer = completion.choices?.[0]?.message?.content ?? "";
  const usage = completion.usage
    ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens
      }
    : undefined;

  return { answer, usage };
}
