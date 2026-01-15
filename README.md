# Mini RAG (Track B)

A small Retrieval-Augmented Generation (RAG) app that:

1) lets a user paste (or upload) text from the frontend,  
2) stores it in a **hosted vector database** (Qdrant Cloud),  
3) retrieves relevant chunks with **MMR** (diversified Top‑k),  
4) applies a **reranker** (Cohere Rerank),  
5) answers with an LLM (OpenAI) **with inline citations** that map to the shown source snippets.

> **Hosting target:** deploy as a single Next.js app on Vercel (free tier), keeping all API keys server-side.

---

## Demo flow

- **Ingest**: paste/upload text → chunk → embed → upsert to Qdrant.
- **Query**: question → embed → vector search → MMR select → rerank → LLM answer with citations → show snippets + timing + token/cost estimates.

---

## Architecture

```mermaid
flowchart LR
  UI[Next.js UI] -->|/api/ingest| ING[Ingest API]
  UI -->|/api/query| QRY[Query API]

  ING -->|chunk| CH[Chunker]
  ING -->|embed| OE[OpenAI Embeddings]
  ING -->|upsert| VDB[(Qdrant Cloud)]

  QRY -->|embed query| OE2[OpenAI Embeddings]
  QRY -->|search (fetch_k)| VDB
  QRY -->|MMR select (top_k)| MMR[MMR Selector]
  QRY -->|rerank| RR[Cohere Rerank]
  QRY -->|answer + citations| LLM[OpenAI Chat]
  QRY --> UI
```

---

## Requirements mapping (per assessment spec)

### 1) Vector database (hosted)

- **Provider:** Qdrant Cloud
- **Collection name:** `QDRANT_COLLECTION` (default: `mini_rag_chunks`)
- **Dimensionality:** `VECTOR_DIMENSIONS` (default `1536` for `text-embedding-3-small`; see `lib/qdrant.ts`)
- **Distance metric:** Cosine
- **Upsert strategy:**
  - **replace** (default): delete all points where `doc_id == <docId>` then upsert fresh points
  - **append:** skip delete and upsert additional points
  - Rationale: keeps IDs simple (UUIDs) while enabling document updates.

### 2) Embeddings & Chunking

- **Embedding model:** configurable via `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)
- **Chunking strategy:** ~`CHUNK_TOKENS=1000` with ~`CHUNK_OVERLAP_TOKENS=120` (≈12%)
  - This repo uses a **practical approximation** of tokens as **~4 characters per token** (`APPROX_CHARS_PER_TOKEN=4`) to keep dependencies light.
  - Chunks snap to nearby whitespace to avoid splitting words.
- **Metadata stored for citation:** `source`, `title`, `section` (markdown-heading heuristic), `chunk_index`, `char_start`, `char_end`, plus the chunk `text`.

### 3) Retriever + Reranker

- **Retriever:** Qdrant similarity search with `FETCH_K` candidates (default 40)
- **Diversification:** MMR selection to `TOP_K` chunks (default 8), `MMR_LAMBDA=0.5`
- **Reranker:** Cohere Rerank (`/v1/rerank`) applied **before** calling the LLM
  - Set `COHERE_API_KEY` to enable it (recommended for the assessment).

### 4) LLM & Answering

- **LLM:** configurable via `OPENAI_CHAT_MODEL` (default `gpt-4o-mini`)
- **Grounding + citations:** sources are passed as `[1] ... [N]` blocks; the model is instructed to cite with `[1]`, `[2]`, etc.
- **No-answer handling:** if nothing is retrieved/reranked with sufficient confidence, the API returns a graceful “I don’t know based on the provided text”.

### 5) Frontend

- Paste/upload area, query box, answer panel with citations + source snippets
- Displays:
  - step timings (chunk/embed/upsert, and embed/retrieve/rerank/llm)
  - rough token/cost estimates (optional; controlled by pricing env vars)

### 6) Hosting & docs

- Designed for **Vercel** (single Next.js app)
- API keys are server-only (route handlers)
- `.env.example` included
- README includes architecture, chunking parameters, retriever/reranker settings, providers, quick-start, and remarks.

---

## Quick start (local)

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- A Qdrant Cloud cluster + API key
- OpenAI API key
- (Recommended) Cohere API key for reranking

### Setup

```bash
cp .env.example .env.local
# fill in your keys + Qdrant URL
npm install
npm run dev
```

Open: http://localhost:3000

---

## Deployment (Vercel – free tier)

1) Push this repo to GitHub.  
2) Create a new Vercel project from the repo.  
3) Set environment variables (Project → Settings → Environment Variables):
   - `QDRANT_URL`, `QDRANT_API_KEY`, `OPENAI_API_KEY`
   - (Recommended) `COHERE_API_KEY`
4) Deploy.

> Note: Route handlers use the Node.js runtime (`export const runtime = "nodejs"`).

---

## Minimal evaluation (gold set)

This repo includes:

- `sample/track-b-spec.md` (a small demo doc)
- `eval/gold.json` (5 Q/A pairs)

### How to run

1) Start the dev server:

```bash
npm run dev
```

2) In another terminal:

```bash
npm run eval
```

The script ingests the sample doc, runs the 5 questions, and reports a **rough** pass/fail based on keyword overlap.

**Success metric (rough):** `% of questions where the returned answer contains ≥50% of the expected keywords` (very approximate).  
For a real assessment, include a short manual note on success rate and common failure modes (e.g., retrieval misses, ambiguous questions).

---

## Index / payload schema

Each Qdrant point stores:

```json
{
  "doc_id": "UUID",
  "title": "My Document",
  "source": "user",
  "section": "Last seen markdown heading",
  "chunk_index": 0,
  "char_start": 0,
  "char_end": 4020,
  "text": "chunk text ...",
  "created_at": "ISO timestamp"
}
```

---

## Remarks (trade-offs & what I’d do next)

- **Approx tokenisation:** chunk sizes are based on a 4 chars/token heuristic. For stricter control, swap in a real tokenizer (e.g., tiktoken) and chunk by true token counts.
- **File formats:** upload supports plain text/markdown (browser reads as text). For PDFs, add server-side parsing (e.g., `pdf-parse`) and/or OCR only when needed.
- **Reranker dependency:** Cohere is optional in code, but for the assessment you should provide `COHERE_API_KEY` so the system always reranks.
- **Multi-document support:** the UI is single-document by default (docId stored in state), but the API can search across all docs if `docId` is omitted.
- **Observability:** add structured logging, request IDs, and rate limiting (especially on the ingest endpoint) before production usage.
- **Security:** if hosting publicly, add basic auth or per-session namespaces to prevent cross-user data mixing.

---

## Boilerplate / templates

- Next.js App Router project structure (standard Next.js conventions).

---

## Resume link

Add your resume link here before submission: **TODO**

