import { QdrantClient } from "@qdrant/js-client-rest";
import { CONFIG } from "./config";

export const VECTOR_DIMENSIONS = CONFIG.qdrant.vectorDimensions;

/**
 * Minimal shape returned by Qdrant search/scroll APIs.
 * We avoid importing `ScoredPoint` because it is not exported in some versions
 * of @qdrant/js-client-rest (causes TS build failures).
 */
export type ScoredPointLike = {
  id: string | number;
  score?: number;
  vector?: unknown;
  payload?: unknown;
};

export async function ensureDocIdIndex(client: QdrantClient): Promise<void> {
  const name = CONFIG.qdrant.collection;

  try {
    await client.createPayloadIndex(name, {
      field_name: "doc_id",
      field_schema: "keyword",
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    // Qdrant may throw different "already exists" messages across versions
    if (
      !msg.toLowerCase().includes("already exists") &&
      !msg.toLowerCase().includes("exists")
    ) {
      throw e;
    }
  }
}

export function getQdrantClient(): QdrantClient {
  return new QdrantClient({
    url: CONFIG.qdrant.url,
    apiKey: CONFIG.qdrant.apiKey,
    port: 443,
    checkCompatibility: false,
  });
}

export async function ensureCollection(client: QdrantClient): Promise<void> {
  const name = CONFIG.qdrant.collection;

  try {
    await client.getCollection(name);
  } catch {
    await client.createCollection(name, {
      vectors: {
        size: VECTOR_DIMENSIONS,
        distance: "Cosine",
      },
    });
  }

  // ensure index exists even if collection already existed
  await ensureDocIdIndex(client);
}

export async function deleteByDocId(
  client: QdrantClient,
  docId: string
): Promise<void> {
  await client.delete(CONFIG.qdrant.collection, {
    filter: {
      must: [{ key: "doc_id", match: { value: docId } }],
    },
  });
}

export type StoredChunkPayload = {
  doc_id: string;
  source?: string;
  title?: string;
  section?: string;
  chunk_index: number;
  char_start: number;
  char_end: number;
  text: string;
  created_at: string;
};

export type RetrievedChunk = {
  id: string;
  score: number;
  vector?: number[];
  payload: StoredChunkPayload;
};

export function mapScoredPoint(p: ScoredPointLike): RetrievedChunk {
  return {
    id: String(p.id),
    score: typeof p.score === "number" ? p.score : 0,
    vector: Array.isArray(p.vector) ? (p.vector as number[]) : undefined,
    payload: (p.payload ?? {}) as StoredChunkPayload,
  };
}
