import { NextResponse } from "next/server";
import { z } from "zod";
import { CONFIG } from "@/lib/config";
import { time } from "@/lib/timing";
import { embedTexts, answerWithCitations } from "@/lib/openai";
import { ensureCollection, getQdrantClient, mapScoredPoint, type RetrievedChunk } from "@/lib/qdrant";
import { mmrSelect } from "@/lib/mmr";
import { rerank } from "@/lib/rerank";
import { estimateLlmCostUsd } from "@/lib/cost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  query: z.string().min(1),
  docId: z.string().optional()
});

type PublicChunk = {
  id: string;
  score: number;
  rerankScore?: number;
  payload: RetrievedChunk["payload"];
};

function toPublic(c: RetrievedChunk & { rerankScore?: number }): PublicChunk {
  return {
    id: c.id,
    score: c.score,
    rerankScore: c.rerankScore,
    payload: c.payload
  };
}

export async function POST(req: Request) {
  const timings: Record<string, number> = {};
  const totalStart = performance.now();

  try {
    const body = BodySchema.parse(await req.json());

    const client = getQdrantClient();
    await ensureCollection(client);

    const [queryVector] = await time(timings, "embed", async () => embedTexts([body.query]));

    const raw = await time(timings, "retrieve", async () => {
      return client.search(CONFIG.qdrant.collection, {
        vector: queryVector,
        limit: CONFIG.retrieval.fetchK,
        with_payload: true,
        with_vector: true,
        filter: body.docId
          ? {
              must: [{ key: "doc_id", match: { value: body.docId } }]
            }
          : undefined
      });
    });

    let retrieved: RetrievedChunk[] = raw.map(mapScoredPoint).filter((p) => p.score >= CONFIG.thresholds.minVdbScore);

    // If nothing passes threshold, still keep a small set for debugging.
    if (retrieved.length === 0) retrieved = raw.map(mapScoredPoint).slice(0, CONFIG.retrieval.topK);

    // MMR selection (diversified top-k)
    let selected: RetrievedChunk[] = [];
    const candidatesWithVectors = retrieved
      .filter((r) => Array.isArray(r.vector))
      .map((r) => ({ item: r, vector: r.vector as number[], baseScore: r.score }));

    if (candidatesWithVectors.length > 0) {
      const mmr = mmrSelect(queryVector, candidatesWithVectors, CONFIG.retrieval.topK, CONFIG.retrieval.mmrLambda);
      selected = mmr.map((m) => m.item);
    } else {
      selected = retrieved.slice(0, CONFIG.retrieval.topK);
    }

    // Rerank (optional in code; provide COHERE_API_KEY for assessment)
    const reranked: Array<RetrievedChunk & { rerankScore?: number }> = await time(timings, "rerank", async () => {
      const res = await rerank({
        query: body.query,
        candidates: selected.map((s) => s.payload.text)
      });

      if (!res) {
        // Fallback: keep vector ordering
        return selected.map((s) => ({ ...s, rerankScore: s.score }));
      }

      const byIndex = new Map<number, number>();
      res.forEach((r) => byIndex.set(r.index, r.score));

      const withScores = selected.map((s, idx) => ({
        ...s,
        rerankScore: byIndex.get(idx) ?? 0
      }));

      withScores.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
      return withScores;
    });

    const topForAnswer = reranked.slice(0, Math.min(6, reranked.length));
    const bestRerank = topForAnswer[0]?.rerankScore ?? 0;

    if (topForAnswer.length === 0 || bestRerank < CONFIG.thresholds.minRerankScore) {
      timings.total = performance.now() - totalStart;
      return NextResponse.json({
        ok: true,
        docId: body.docId ?? null,
        query: body.query,
        noAnswer: true,
        answer:
          "I don’t know based on the provided document text. Try ingesting more relevant content, or ask a more specific question.",
        retrieved: retrieved.map(toPublic),
        reranked: reranked.map(toPublic),
        timingsMs: timings
      });
    }

    const llm = await time(timings, "llm", async () =>
      answerWithCitations({
        question: body.query,
        sources: topForAnswer.map((s, i) => ({
          n: i + 1,
          text: s.payload.text,
          title: s.payload.title,
          section: s.payload.section,
          chunk_index: s.payload.chunk_index
        }))
      })
    );

    const promptTokens = llm.usage?.prompt_tokens ?? 0;
    const completionTokens = llm.usage?.completion_tokens ?? 0;

    timings.total = performance.now() - totalStart;

    return NextResponse.json({
      ok: true,
      docId: body.docId ?? null,
      query: body.query,
      answer: llm.answer,
      noAnswer: false,
      retrieved: retrieved.map(toPublic),
      reranked: reranked.map(toPublic),
      timingsMs: timings,
      usage: {
        llmPromptTokens: promptTokens,
        llmCompletionTokens: completionTokens,
        llmTotalTokens: llm.usage?.total_tokens ?? 0,
        llmApproxCostUsd: estimateLlmCostUsd(promptTokens, completionTokens)
      }
    });
  } catch (err: any) {
    timings.total = performance.now() - totalStart;
    return NextResponse.json(
      {
        ok: false,
        message: err?.message ?? String(err),
        timingsMs: timings
      },
      { status: 400 }
    );
  }
}
