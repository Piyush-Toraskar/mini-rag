import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CONFIG } from "@/lib/config";
import { chunkText } from "@/lib/chunking";
import { estimateEmbeddingCostUsd, approxTokens } from "@/lib/cost";
import { time } from "@/lib/timing";
import { embedTexts } from "@/lib/openai";
import { deleteByDocId, ensureCollection, getQdrantClient, VECTOR_DIMENSIONS } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  text: z.string().min(1),
  title: z.string().optional(),
  source: z.string().optional(),
  docId: z.string().optional(),
  mode: z.enum(["replace", "append"]).default("replace")
});

export async function POST(req: Request) {
  const timings: Record<string, number> = {};
  const totalStart = performance.now();

  try {
    const body = BodySchema.parse(await req.json());

    const docId = body.docId ?? randomUUID();
    const title = body.title ?? "Untitled";
    const source = body.source ?? "user";

    const client = getQdrantClient();
    await ensureCollection(client);

    if (body.mode === "replace") {
      await time(timings, "delete", async () => deleteByDocId(client, docId));
    }

    const chunks = await time(timings, "chunk", async () =>
      chunkText(body.text, {
        approxTokensPerChunk: CONFIG.chunking.approxTokensPerChunk,
        approxTokensOverlap: CONFIG.chunking.approxTokensOverlap,
        approxCharsPerToken: CONFIG.chunking.approxCharsPerToken
      })
    );

    const { approxTokens: embedApproxTokens, approxCostUsd: embedApproxCostUsd } = estimateEmbeddingCostUsd(
      chunks.map((c) => c.text)
    );

    const embeddings: number[][] = [];
    const batchSize = 64;

    await time(timings, "embed", async () => {
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize).map((c) => c.text);
        const vecs = await embedTexts(batch);
        embeddings.push(...vecs);
      }
    });

    if (embeddings.length !== chunks.length) {
      throw new Error(`Embedding count mismatch: got ${embeddings.length}, expected ${chunks.length}`);
    }

    const createdAt = new Date().toISOString();

    await time(timings, "upsert", async () => {
      const points = chunks.map((c, i) => ({
        id: randomUUID(),
        vector: embeddings[i]!,
        payload: {
          doc_id: docId,
          title,
          source,
          section: c.section,
          chunk_index: c.chunk_index,
          char_start: c.char_start,
          char_end: c.char_end,
          text: c.text,
          created_at: createdAt
        }
      }));

      // Qdrant accepts upserts in batches as well; keep it simple.
      const upsertBatchSize = 128;
      for (let i = 0; i < points.length; i += upsertBatchSize) {
        await client.upsert(CONFIG.qdrant.collection, {
          points: points.slice(i, i + upsertBatchSize)
        });
      }
    });

    timings.total = performance.now() - totalStart;

    return NextResponse.json({
      ok: true,
      docId,
      collection: CONFIG.qdrant.collection,
      chunksAdded: chunks.length,
      dimensions: VECTOR_DIMENSIONS,
      chunking: {
        approxTokensPerChunk: CONFIG.chunking.approxTokensPerChunk,
        approxTokensOverlap: CONFIG.chunking.approxTokensOverlap,
        approxCharsPerToken: CONFIG.chunking.approxCharsPerToken
      },
      timingsMs: timings,
      estimates: {
        inputApproxTokens: approxTokens(body.text),
        embeddingApproxTokens: embedApproxTokens,
        embeddingApproxCostUsd: embedApproxCostUsd
      }
    });
  } catch (err: any) {
    timings.total = performance.now() - totalStart;

    console.error("INGEST_ERROR", err);

    return NextResponse.json(
      {
        ok: false,
        message: err?.message ?? String(err),
        name: err?.name,
        stack: err?.stack,
        cause: err?.cause,
        // common patterns for HTTP client errors
        status: err?.status ?? err?.response?.status,
        data: err?.data ?? err?.response?.data,
        timingsMs: timings
      },
      { status: 500 }
    );
  }
}
