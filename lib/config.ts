import { z } from "zod";

const EnvSchema = z.object({
  // Qdrant Cloud
  QDRANT_URL: z.string().min(1),
  QDRANT_API_KEY: z.string().min(1),
  QDRANT_COLLECTION: z.string().default("mini_rag_chunks_local_384"),
  VECTOR_DIMENSIONS: z.coerce.number().default(384),

  // Groq (chat)
  GROQ_API_KEY: z.string().min(1),
  GROQ_CHAT_MODEL: z.string().default("llama-3.1-8b-instant"),

  // Optional reranker
  COHERE_API_KEY: z.string().optional(),
  COHERE_RERANK_MODEL: z.string().default("rerank-english-v3.0"),

  // Chunking
  APPROX_CHARS_PER_TOKEN: z.coerce.number().default(4),
  CHUNK_TOKENS: z.coerce.number().default(1000),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().default(120),

  // Retrieval
  TOP_K: z.coerce.number().default(8),
  FETCH_K: z.coerce.number().default(40),
  MMR_LAMBDA: z.coerce.number().default(0.5),

  // Thresholds
  MIN_VDB_SCORE: z.coerce.number().default(0.15),
  MIN_RERANK_SCORE: z.coerce.number().default(0.0),

  // Kept for UI cost fields (set to 0 in .env.local)
  OPENAI_EMBED_USD_PER_1M: z.coerce.number().default(0),
  OPENAI_PROMPT_USD_PER_1M: z.coerce.number().default(0),
  OPENAI_COMPLETION_USD_PER_1M: z.coerce.number().default(0)
});

export type AppEnv = z.infer<typeof EnvSchema>;

// Parse from process.env directly (works fine in Next server runtime)
export const ENV: AppEnv = EnvSchema.parse(process.env);

export const CONFIG = {
  qdrant: {
    url: ENV.QDRANT_URL,
    apiKey: ENV.QDRANT_API_KEY,
    collection: ENV.QDRANT_COLLECTION,
    vectorDimensions: ENV.VECTOR_DIMENSIONS
  },

  groq: {
    apiKey: ENV.GROQ_API_KEY,
    chatModel: ENV.GROQ_CHAT_MODEL
  },

  cohere: {
    apiKey: ENV.COHERE_API_KEY,
    rerankModel: ENV.COHERE_RERANK_MODEL
  },

  chunking: {
    approxCharsPerToken: ENV.APPROX_CHARS_PER_TOKEN,
    approxTokensPerChunk: ENV.CHUNK_TOKENS,
    approxTokensOverlap: ENV.CHUNK_OVERLAP_TOKENS
  },

  retrieval: {
    topK: ENV.TOP_K,
    fetchK: ENV.FETCH_K,
    mmrLambda: ENV.MMR_LAMBDA
  },

  thresholds: {
    minVdbScore: ENV.MIN_VDB_SCORE,
    minRerankScore: ENV.MIN_RERANK_SCORE
  },

  pricing: {
    embedUsdPer1M: ENV.OPENAI_EMBED_USD_PER_1M,
    promptUsdPer1M: ENV.OPENAI_PROMPT_USD_PER_1M,
    completionUsdPer1M: ENV.OPENAI_COMPLETION_USD_PER_1M
  }
} as const;
