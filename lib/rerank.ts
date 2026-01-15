import { CONFIG } from "./config";

export type RerankResult = Array<{ index: number; score: number }>;

export async function cohereRerank(opts: {
  apiKey: string;
  model: string;
  query: string;
  documents: string[];
  topN?: number;
}): Promise<RerankResult> {
  const resp = await fetch("https://api.cohere.ai/v1/rerank", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${opts.apiKey}`,
      "accept": "application/json"
    },
    body: JSON.stringify({
      model: opts.model,
      query: opts.query,
      documents: opts.documents,
      top_n: opts.topN ?? Math.min(10, opts.documents.length),
      return_documents: false
    })
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Cohere rerank failed (${resp.status}): ${txt.slice(0, 500)}`);
  }

  const data = (await resp.json()) as any;
  const results = (data?.results ?? []) as any[];
  return results.map((r) => ({ index: r.index as number, score: r.relevance_score as number }));
}

export async function rerank(opts: { query: string; candidates: string[] }): Promise<RerankResult | null> {
  if (!CONFIG.cohere.apiKey) return null;
  return cohereRerank({
    apiKey: CONFIG.cohere.apiKey,
    model: CONFIG.cohere.rerankModel,
    query: opts.query,
    documents: opts.candidates,
    topN: Math.min(CONFIG.retrieval.topK, opts.candidates.length)
  });
}
