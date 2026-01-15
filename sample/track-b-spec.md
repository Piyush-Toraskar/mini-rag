# Track B: AI Engineer Assessment ("Mini RAG")

## Goal
Build and host a small RAG app: users input text (upload file is optional) from the frontend, you store it in a cloud-hosted vector DB, retrieve the most relevant chunks with a retriever + reranker, and answer the query via an LLM. Show citations.

## Requirements

### 1. Vector database (hosted)
- Use any cloud option (e.g., Pinecone/Weaviate/Qdrant/Supabase pgvector/Zilliz).
- Document index/collection name, dimensionality, and upsert strategy.

### 2. Embeddings & Chunking
- Use any embedding model (e.g., OpenAI/Google/Cohere/Jina/Voyage/Nomic).
- Implement a clear chunking strategy (size & overlap; e.g., 800–1,200 tokens with 10–15% overlap).
- Store metadata (source, title, section, position) for later citation.

### 3. Retriever + Reranker
- Top-k retrieval (MMR or similar) from vector DB.
- Apply a reranker (e.g., Cohere Rerank, Jina Reranker, Voyage Rerank, or a hosted BGE reranker) before answering.

### 4. LLM & Answering
- Use any provider (Groq Cloud, AI Studio/Gemini, OpenAI, etc.).
- Generate a grounded answer with inline citations (e.g., [1], [2]) that map to source snippets shown below the answer.
- Handle no-answer cases gracefully.

### 5. Frontend
- Upload/paste area for text, a query box, and an answers panel with citations & sources.
- Show simple request timing and token/cost estimates (rough is fine).

### 6. Hosting & Docs
- Deploy on a free host (e.g., Vercel/Netlify/Render/HF Spaces/Railway/Fly).
- Keep API keys server-side; provide .env.example.
- README with architecture diagram, chunking params, retriever/reranker settings, providers used, and quick-start.
- Add a Remarks section if you hit provider limits or made trade-offs.

## Acceptance Criteria
- Working URL; first screen loads without console errors.
- Query → retrieved chunks → reranked → LLM answer with citations visible.
- Minimal eval: include 5 Q/A pairs (gold set) and a short note on precision/recall or success rate.

## Submission Checklist (both tracks)
- Live URL(s)
- Public GitHub repo
- README with setup, architecture, and resume link
- Clear schema (Track A) / index config (Track B)
- "Remarks" section (limits, trade-offs, what you’d do next)

## Disqualifiers
- Broken/non-loading URL, missing README, or no schema/index details.
- No working query flow (Track A filters / Track B retrieval → rerank → answer).
- Obvious plagiarism (copy-paste repos without attribution or understanding).

## Notes for Candidates (fairness & scope)
- Keep scope small but production-minded: proper errors, env vars, basic logging.
- You may use templates/boilerplates; cite them.
- Aim for 2–6 hours of focused effort within the 72-hour window.
