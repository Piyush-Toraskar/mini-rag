"use client";

import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

type IngestResponse = {
  ok: boolean;
  docId?: string;
  collection?: string;
  chunksAdded?: number;
  dimensions?: number;
  chunking?: { approxTokensPerChunk: number; approxTokensOverlap: number; approxCharsPerToken: number };
  timingsMs?: Record<string, number>;
  estimates?: {
    inputApproxTokens: number;
    embeddingApproxTokens: number;
    embeddingApproxCostUsd: number;
  };
  message?: string;
};

type SourceSnippet = {
  id: string;
  score: number;
  rerankScore?: number;
  payload: {
    doc_id: string;
    title?: string;
    source?: string;
    section?: string;
    chunk_index: number;
    char_start: number;
    char_end: number;
    text: string;
  };
};

type QueryResponse = {
  ok: boolean;
  docId?: string;
  query?: string;
  answer?: string;
  noAnswer?: boolean;
  citations?: Array<{ n: number; sourceId: string }>;
  retrieved?: SourceSnippet[];
  reranked?: SourceSnippet[];
  timingsMs?: Record<string, number>;
  usage?: {
    llmPromptTokens?: number;
    llmCompletionTokens?: number;
    llmTotalTokens?: number;
    llmApproxCostUsd?: number;
  };
  message?: string;
};

function formatMs(ms?: number) {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatUsd(x?: number) {
  if (x === undefined) return "—";
  return `$${x.toFixed(4)}`;
}

export default function Page() {
  const [docTitle, setDocTitle] = useState<string>("My Document");
  const [docSource, setDocSource] = useState<string>("user");
  const [docText, setDocText] = useState<string>("");
  const [docId, setDocId] = useState<string>("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestResp, setIngestResp] = useState<IngestResponse | null>(null);
  const [ingestErr, setIngestErr] = useState<string>("");

  const [query, setQuery] = useState<string>("");
  const [asking, setAsking] = useState(false);
  const [queryResp, setQueryResp] = useState<QueryResponse | null>(null);
  const [queryErr, setQueryErr] = useState<string>("");

  const sourcesByNumber = useMemo(() => {
    const reranked = queryResp?.reranked ?? [];
    const map = new Map<number, SourceSnippet>();
    reranked.forEach((s, i) => map.set(i + 1, s));
    return map;
  }, [queryResp]);

  async function onPickFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setDocText(text);
  }

  async function ingest(mode: "replace" | "append" = "replace") {
    setIngestErr("");
    setIngestResp(null);
    if (!docText.trim()) {
      setIngestErr("Please paste some text (or upload a .txt/.md file) before ingesting.");
      return;
    }
    setIngesting(true);
    try {
      const resp = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: docText,
          title: docTitle,
          source: docSource,
          docId: docId || undefined,
          mode
        })
      });
      const data = (await resp.json()) as IngestResponse;
      if (!resp.ok || !data.ok) {
        setIngestErr(data.message || `Ingest failed (${resp.status})`);
      } else {
        setIngestResp(data);
        if (data.docId) setDocId(data.docId);
      }
    } catch (e: any) {
      setIngestErr(e?.message || String(e));
    } finally {
      setIngesting(false);
    }
  }

  async function ask() {
    setQueryErr("");
    setQueryResp(null);
    if (!query.trim()) {
      setQueryErr("Please enter a question.");
      return;
    }
    setAsking(true);
    try {
      const resp = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          docId: docId || undefined
        })
      });
      const data = (await resp.json()) as QueryResponse;
      if (!resp.ok || !data.ok) {
        setQueryErr(data.message || `Query failed (${resp.status})`);
      } else {
        setQueryResp(data);
      }
    } catch (e: any) {
      setQueryErr(e?.message || String(e));
    } finally {
      setAsking(false);
    }
  }

  return (
    <main>
      <h1>Mini RAG</h1>
      <p>
        Paste (or upload) text, ingest into a hosted vector database, then ask questions. The backend retrieves
        chunks (MMR), reranks them, and answers via an LLM with inline citations.
      </p>

      <div className="grid">
        <section className="card">
          <h2>1) Ingest document</h2>

          <div className="row">
            <span className="pill">
              <span>Doc ID</span>
              <span className="mono">{docId ? docId : "— (assigned on ingest)"}</span>
            </span>
            <span className="pill">
              <span>Mode</span>
              <span className="mono">replace (default)</span>
            </span>
          </div>

          <label>Title (metadata)</label>
          <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} type="text" />

          <label>Source (metadata)</label>
          <input value={docSource} onChange={(e) => setDocSource(e.target.value)} type="text" />

          <label>Upload text file (optional)</label>
          <input
            type="file"
            accept=".txt,.md,.markdown,text/plain"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />

          <label>Paste text</label>
          <textarea
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            placeholder="Paste your document here…"
          />

          <div className="row">
            <button onClick={() => ingest("replace")} disabled={ingesting}>
              {ingesting ? "Ingesting…" : "Ingest (replace)"}
            </button>
            <button onClick={() => ingest("append")} disabled={ingesting}>
              {ingesting ? "Ingesting…" : "Ingest (append)"}
            </button>
          </div>

          {ingestErr ? <div className="err">{ingestErr}</div> : null}

          {ingestResp?.ok ? (
            <>
              <div className="ok">
                Ingested {ingestResp.chunksAdded} chunks into <span className="mono">{ingestResp.collection}</span>.
              </div>
              <hr />
              <div className="kv">
                <div className="k">Vector dimensions</div>
                <div className="v mono">{ingestResp.dimensions}</div>

                <div className="k">Chunking</div>
                <div className="v mono">
                  ~{ingestResp.chunking?.approxTokensPerChunk} tokens/chunk, ~{ingestResp.chunking?.approxTokensOverlap} overlap
                </div>

                <div className="k">Embedding tokens (approx)</div>
                <div className="v mono">{ingestResp.estimates?.embeddingApproxTokens}</div>

                <div className="k">Embedding cost (approx)</div>
                <div className="v mono">{formatUsd(ingestResp.estimates?.embeddingApproxCostUsd)}</div>

                <div className="k">Timings</div>
                <div className="v">
                  <div className="small">
                    chunk: {formatMs(ingestResp.timingsMs?.chunk)} · embed: {formatMs(ingestResp.timingsMs?.embed)} · upsert:{" "}
                    {formatMs(ingestResp.timingsMs?.upsert)} · total: {formatMs(ingestResp.timingsMs?.total)}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <section className="card">
          <h2>2) Ask a question</h2>

          <label>Question</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="text" placeholder="e.g., What are the key requirements?" />

          <button onClick={ask} disabled={asking}>
            {asking ? "Asking…" : "Ask"}
          </button>

          {queryErr ? <div className="err">{queryErr}</div> : null}

          {queryResp?.ok ? (
            <>
              <hr />
              <h3>Answer</h3>
              {queryResp.noAnswer ? (
                <div className="pre">{queryResp.answer}</div>
              ) : (
                <div className="pre">
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{queryResp.answer || ""}</ReactMarkdown>
                </div>
              )}

              <div className="small">
                total: {formatMs(queryResp.timingsMs?.total)} · embed: {formatMs(queryResp.timingsMs?.embed)} · retrieve:{" "}
                {formatMs(queryResp.timingsMs?.retrieve)} · rerank: {formatMs(queryResp.timingsMs?.rerank)} · llm:{" "}
                {formatMs(queryResp.timingsMs?.llm)}
              </div>

              <div className="small">
                LLM tokens: {queryResp.usage?.llmTotalTokens ?? "—"} · approx LLM cost: {formatUsd(queryResp.usage?.llmApproxCostUsd)}
              </div>

              <hr />
              <h3>Sources (reranked)</h3>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 46 }}>#</th>
                    <th>Snippet</th>
                    <th style={{ width: 110 }}>Scores</th>
                  </tr>
                </thead>
                <tbody>
                  {(queryResp.reranked ?? []).map((s, idx) => (
                    <tr key={s.id}>
                      <td className="code">[{idx + 1}]</td>
                      <td>
                        <div className="small">
                          <span className="mono">{s.payload.title || "Untitled"}</span> · section{" "}
                          <span className="mono">{s.payload.section || "—"}</span> · chunk{" "}
                          <span className="mono">{s.payload.chunk_index}</span>
                        </div>
                        <div className="pre" style={{ marginTop: 6 }}>{s.payload.text}</div>
                      </td>
                      <td>
                        <div className="small">
                          vdb: <span className="mono">{s.score.toFixed(3)}</span>
                        </div>
                        <div className="small">
                          rerank: <span className="mono">{(s.rerankScore ?? 0).toFixed(3)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <details style={{ marginTop: 12 }}>
                <summary className="small">Show raw retrieval (pre-rerank)</summary>
                <div style={{ marginTop: 10 }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 46 }}>#</th>
                        <th>Snippet</th>
                        <th style={{ width: 90 }}>VDB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(queryResp.retrieved ?? []).map((s, idx) => (
                        <tr key={s.id}>
                          <td className="code">{idx + 1}</td>
                          <td>
                            <div className="small">
                              <span className="mono">{s.payload.title || "Untitled"}</span> · section{" "}
                              <span className="mono">{s.payload.section || "—"}</span> · chunk{" "}
                              <span className="mono">{s.payload.chunk_index}</span>
                            </div>
                            <div className="pre" style={{ marginTop: 6 }}>{s.payload.text}</div>
                          </td>
                          <td className="mono">{s.score.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : null}
        </section>
      </div>

      <hr />
      <p className="small">
        Tip: If you don’t ingest a document first, queries will search across all stored chunks in the collection
        (useful for multi-document demos). For an assessment, keep it to a single doc per run.
      </p>
    </main>
  );
}
