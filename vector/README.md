# Vector / Embedding / RAG Module

This directory organizes vector search and RAG (Retrieval-Augmented Generation) resources.

## Implementation Location

The actual vector implementation lives in the backend:

- **`backend/app/services/vector_store.py`** — Core vector store: chunking, embeddings (hash-based fallback + OpenAI), cosine similarity, pgvector HNSW index, top-K ANN search, Pinecone & Weaviate adapters, RAG pipeline.
- **`backend/app/api/v1/vector.py`** — REST API endpoints for vector operations.
- **`backend/app/db/models.py`** — `ContractEmbedding` table storing pgvector `VECTOR(1536)` columns.

## Folder Structure

```
vector/
├── embeddings/    # Future: standalone embedding generation scripts / notebooks
├── search/        # Future: standalone search evaluation / benchmarks
└── rag/           # Future: RAG pipeline configuration and evaluation
```

## Technology

- **Storage:** PostgreSQL + pgvector extension, HNSW index
- **Distance metric:** Cosine similarity
- **Embedding model:** OpenAI `text-embedding-3-small` (1536-dim) with deterministic hash-based fallback
- **Chunking:** Recursive sliding-window (configurable size & overlap)
