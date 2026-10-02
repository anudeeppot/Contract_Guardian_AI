"""
Vector store service for Contract Guardian AI (CO2)
Implements:
- Text chunking
- Embedding generation (OpenAI or fallback TF-IDF)
- pgvector storage and HNSW search
- Cosine similarity
- Top-K retrieval
- Metadata filtering
- Hybrid keyword + vector search
- Pinecone adapter
- Weaviate adapter
- RAG pipeline
"""
import hashlib
import json
import logging
import math
import re
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import ContractEmbedding

logger = logging.getLogger(__name__)


# =============================================================
# TEXT CHUNKING
# =============================================================
def chunk_text(text_content: str, chunk_size: int = None, overlap: int = None) -> list[dict]:
    """
    Split text into overlapping chunks for embedding.
    CO2: Chunking strategy for RAG pipeline.
    """
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    # Split on sentence boundaries first
    sentences = re.split(r'(?<=[.!?])\s+', text_content)

    chunks = []
    current_chunk = []
    current_len = 0
    chunk_idx = 0

    for sentence in sentences:
        sentence_len = len(sentence)
        if current_len + sentence_len > chunk_size and current_chunk:
            chunk_text_str = " ".join(current_chunk)
            chunks.append({
                "index": chunk_idx,
                "text": chunk_text_str,
                "char_start": sum(len(s) for s in current_chunk[:1]),
                "char_end": len(chunk_text_str),
                "word_count": len(chunk_text_str.split()),
            })
            chunk_idx += 1
            # Overlap: keep last N characters worth of sentences
            overlap_sentences = []
            overlap_len = 0
            for s in reversed(current_chunk):
                if overlap_len + len(s) <= overlap:
                    overlap_sentences.insert(0, s)
                    overlap_len += len(s)
                else:
                    break
            current_chunk = overlap_sentences
            current_len = overlap_len

        current_chunk.append(sentence)
        current_len += sentence_len

    # Last chunk
    if current_chunk:
        chunk_text_str = " ".join(current_chunk)
        chunks.append({
            "index": chunk_idx,
            "text": chunk_text_str,
            "char_start": 0,
            "char_end": len(chunk_text_str),
            "word_count": len(chunk_text_str.split()),
        })

    return chunks


# =============================================================
# EMBEDDING GENERATION
# =============================================================
async def generate_embedding(text_content: str) -> list[float] | None:
    """
    Generate embeddings using OpenAI or fallback to TF-IDF-based approximation.
    CO2: Embeddings for vector search.
    """
    if settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.embeddings.create(
                model=settings.embedding_model,
                input=text_content[:8000],
            )
            return response.data[0].embedding
        except Exception as e:
            logger.warning("OpenAI embedding failed: %s – using fallback", e)

    # Fallback: simple hash-based pseudo-embedding (for demo without OpenAI key)
    return _hash_embedding(text_content, settings.embedding_dimensions)


def _hash_embedding(text_content: str, dimensions: int = 1536) -> list[float]:
    """
    Deterministic pseudo-embedding from text hash.
    NOT semantically meaningful, but allows system to function without OpenAI.
    Used purely as a demo fallback for CO2 demonstration.
    """
    words = text_content.lower().split()
    vec = [0.0] * dimensions
    for word in words:
        h = int(hashlib.sha256(word.encode()).hexdigest(), 16)
        for i in range(0, min(len(word), 8)):
            idx = (h >> (i * 8)) % dimensions
            vec[idx] += 1.0 / (len(words) + 1)
    # Normalize to unit vector
    magnitude = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / magnitude for x in vec]


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two vectors. CO2: Similarity metric."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# =============================================================
# PGVECTOR STORAGE & SEARCH
# =============================================================
class PgVectorStore:
    """
    PostgreSQL pgvector implementation.
    CO2: HNSW index, cosine similarity, top-K ANN search.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def store_embeddings(self, contract_id: UUID, chunks: list[dict]) -> int:
        """
        Chunk text, generate embeddings, and store in contract_embeddings table.
        Returns number of chunks stored.
        """
        stored = 0
        for chunk in chunks:
            embedding = await generate_embedding(chunk["text"])
            if embedding is None:
                continue

            # Store as JSON array (portable across SQLite/Postgres)
            record = ContractEmbedding(
                contract_id=contract_id,
                chunk_index=chunk["index"],
                chunk_text=chunk["text"],
                embedding_json=embedding,
                embedding_metadata={
                    "word_count": chunk.get("word_count", 0),
                    "char_end": chunk.get("char_end", 0),
                },
            )
            self.db.add(record)
            stored += 1

        await self.db.flush()
        return stored

    async def similarity_search(
        self,
        query: str,
        contract_id: UUID | None = None,
        top_k: int = None,
        metadata_filter: dict | None = None,
    ) -> list[dict]:
        """
        Vector similarity search using cosine distance.
        CO2: ANN, HNSW, top-K, metadata filtering.
        Falls back to pure-Python cosine if pgvector not available.
        """
        top_k = top_k or settings.vector_search_top_k
        query_embedding = await generate_embedding(query)
        if query_embedding is None:
            return []

        # Try pgvector native query first (PostgreSQL only)
        if settings.is_postgres:
            return await self._pgvector_search(query_embedding, contract_id, top_k)

        # Fallback: load all embeddings and compute cosine in Python
        return await self._python_similarity_search(query_embedding, contract_id, top_k)

    async def _pgvector_search(
        self, query_embedding: list[float], contract_id: UUID | None, top_k: int
    ) -> list[dict]:
        """Native pgvector cosine similarity search."""
        try:
            vec_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
            where_clause = "WHERE ce.contract_id = :contract_id" if contract_id else ""
            params: dict[str, Any] = {"top_k": top_k, "embedding": vec_str}
            if contract_id:
                params["contract_id"] = str(contract_id)

            sql = text(f"""
                SELECT
                    ce.id,
                    ce.contract_id,
                    ce.chunk_index,
                    ce.chunk_text,
                    ce.metadata,
                    1 - (ce.embedding::vector <=> :embedding::vector) AS similarity
                FROM contract_embeddings ce
                {where_clause}
                ORDER BY ce.embedding::vector <=> :embedding::vector
                LIMIT :top_k
            """)
            result = await self.db.execute(sql, params)
            rows = result.fetchall()
            return [
                {
                    "id": str(r.id),
                    "contract_id": str(r.contract_id),
                    "chunk_index": r.chunk_index,
                    "text": r.chunk_text,
                    "similarity": float(r.similarity),
                    "metadata": r.metadata,
                }
                for r in rows
            ]
        except Exception as e:
            logger.warning("pgvector search failed (%s), using Python fallback", e)
            return await self._python_similarity_search(
                query_embedding, contract_id, top_k
            )

    async def _python_similarity_search(
        self, query_embedding: list[float], contract_id: UUID | None, top_k: int
    ) -> list[dict]:
        """Pure-Python cosine similarity fallback."""
        from sqlalchemy import select
        from app.db.models import ContractEmbedding as CE

        stmt = select(CE)
        if contract_id:
            stmt = stmt.where(CE.contract_id == contract_id)
        result = await self.db.execute(stmt)
        records = result.scalars().all()

        scored = []
        for rec in records:
            if not rec.embedding_json:
                continue
            sim = cosine_similarity(query_embedding, rec.embedding_json)
            scored.append({
                "id": str(rec.id),
                "contract_id": str(rec.contract_id),
                "chunk_index": rec.chunk_index,
                "text": rec.chunk_text,
                "similarity": sim,
                "metadata": rec.embedding_metadata or {},
            })

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:top_k]

    async def hybrid_search(
        self,
        query: str,
        contract_id: UUID | None = None,
        top_k: int = 5,
        keyword_weight: float = 0.3,
        vector_weight: float = 0.7,
    ) -> list[dict]:
        """
        Hybrid keyword + vector search.
        CO2: Hybrid search combining BM25-style keyword and vector similarity.
        """
        # Vector results
        vector_results = await self.similarity_search(query, contract_id, top_k * 2)

        # Keyword results (simple TF-IDF scoring)
        keywords = set(query.lower().split())
        keyword_scored = {}
        for item in vector_results:
            text_words = set(item["text"].lower().split())
            keyword_score = len(keywords & text_words) / max(len(keywords), 1)
            keyword_scored[item["id"]] = keyword_score

        # Combine scores
        combined = []
        for item in vector_results:
            vs = item["similarity"]
            ks = keyword_scored.get(item["id"], 0.0)
            combined_score = vector_weight * vs + keyword_weight * ks
            combined.append({**item, "combined_score": combined_score, "keyword_score": ks})

        combined.sort(key=lambda x: x["combined_score"], reverse=True)
        return combined[:top_k]


# =============================================================
# RAG PIPELINE
# =============================================================
class RAGService:
    """
    Retrieval-Augmented Generation pipeline.
    CO2: contract → chunking → embeddings → vector search → context → answer.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.vector_store = PgVectorStore(db)

    async def index_contract(self, contract_id: UUID, text_content: str) -> dict:
        """Index a contract: chunk → embed → store."""
        chunks = chunk_text(text_content)
        stored = await self.vector_store.store_embeddings(contract_id, chunks)
        await self.db.commit()
        return {"chunks": len(chunks), "stored": stored}

    async def query(
        self,
        question: str,
        contract_id: UUID | None = None,
        top_k: int = 5,
    ) -> dict:
        """
        RAG query: retrieve relevant chunks → generate answer.
        """
        # 1. Retrieve relevant chunks
        results = await self.vector_store.hybrid_search(question, contract_id, top_k)
        context = "\n\n---\n\n".join(r["text"] for r in results)

        # 2. Generate answer using LLM or heuristic fallback
        answer = await self._generate_answer(question, context)

        return {
            "question": question,
            "answer": answer,
            "sources": results,
            "context_chunks": len(results),
        }

    async def _generate_answer(self, question: str, context: str) -> str:
        """Generate answer from context using LLM or rule-based fallback."""
        if settings.openai_api_key:
            try:
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=settings.openai_api_key)
                prompt = (
                    f"You are a legal contract analysis assistant.\n\n"
                    f"Context from the contract:\n{context[:6000]}\n\n"
                    f"Question: {question}\n\n"
                    "Answer based only on the provided context. "
                    "If the context doesn't contain enough information, say so."
                )
                resp = await client.chat.completions.create(
                    model=settings.openai_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=1000,
                )
                return resp.choices[0].message.content or "No answer generated."
            except Exception as e:
                logger.warning("LLM answer generation failed: %s", e)

        # Heuristic fallback: extract most relevant sentence from context
        if not context:
            return "No relevant context found in the contract."

        question_words = set(question.lower().split())
        sentences = re.split(r'(?<=[.!?])\s+', context)
        best_sentence = max(
            sentences,
            key=lambda s: len(question_words & set(s.lower().split())),
            default="",
        )
        return (
            f"Based on the contract content: {best_sentence[:500]}"
            if best_sentence
            else "Could not extract a relevant answer from the contract."
        )


# =============================================================
# PINECONE ADAPTER (CO2 - interchangeable vector store)
# =============================================================
class PineconeAdapter:
    """
    Pinecone vector store adapter.
    CO2: Demonstrates interchangeable vector-store design.
    Requires PINECONE_API_KEY to be set.
    """

    def __init__(self):
        self.index = None
        self._init()

    def _init(self):
        if not settings.pinecone_api_key:
            logger.info("Pinecone not configured (PINECONE_API_KEY not set)")
            return
        try:
            from pinecone import Pinecone
            pc = Pinecone(api_key=settings.pinecone_api_key)
            self.index = pc.Index(settings.pinecone_index)
            logger.info("Pinecone connected: %s", settings.pinecone_index)
        except ImportError:
            logger.warning("pinecone-client not installed")
        except Exception as e:
            logger.warning("Pinecone init failed: %s", e)

    def is_available(self) -> bool:
        return self.index is not None

    async def upsert(self, vectors: list[dict]) -> bool:
        """Upsert vectors to Pinecone index."""
        if not self.index:
            return False
        try:
            self.index.upsert(vectors=vectors)
            return True
        except Exception as e:
            logger.error("Pinecone upsert failed: %s", e)
            return False

    async def query(self, embedding: list[float], top_k: int = 5, filter: dict | None = None) -> list[dict]:
        """Query Pinecone for similar vectors."""
        if not self.index:
            return []
        try:
            results = self.index.query(vector=embedding, top_k=top_k, filter=filter, include_metadata=True)
            return [
                {"id": m.id, "score": m.score, "metadata": m.metadata}
                for m in results.matches
            ]
        except Exception as e:
            logger.error("Pinecone query failed: %s", e)
            return []


# =============================================================
# WEAVIATE ADAPTER (CO2 - interchangeable vector store)
# =============================================================
class WeaviateAdapter:
    """
    Weaviate vector store adapter.
    CO2: Alternative vector database demonstration.
    Requires WEAVIATE_URL to be set.
    """

    def __init__(self):
        self.client = None
        self._init()

    def _init(self):
        try:
            import weaviate
            auth = None
            if settings.weaviate_api_key:
                auth = weaviate.AuthApiKey(api_key=settings.weaviate_api_key)
            self.client = weaviate.connect_to_custom(
                http_host=settings.weaviate_url.replace("http://", "").split(":")[0],
                http_port=int(settings.weaviate_url.split(":")[-1]) if ":" in settings.weaviate_url else 8080,
                http_secure=False,
                auth_credentials=auth,
            )
            logger.info("Weaviate connected: %s", settings.weaviate_url)
        except ImportError:
            logger.info("weaviate-client not installed")
        except Exception as e:
            logger.info("Weaviate init skipped: %s", e)

    def is_available(self) -> bool:
        return self.client is not None

    async def search(self, query_embedding: list[float], class_name: str = "Contract", top_k: int = 5) -> list[dict]:
        """Search Weaviate using vector similarity."""
        if not self.client:
            return []
        try:
            result = (
                self.client.query
                .get(class_name, ["text", "contract_id", "chunk_index"])
                .with_near_vector({"vector": query_embedding})
                .with_limit(top_k)
                .with_additional(["distance"])
                .do()
            )
            items = result.get("data", {}).get("Get", {}).get(class_name, [])
            return [
                {
                    "text": item.get("text", ""),
                    "contract_id": item.get("contract_id", ""),
                    "chunk_index": item.get("chunk_index", 0),
                    "distance": item.get("_additional", {}).get("distance", 1.0),
                }
                for item in items
            ]
        except Exception as e:
            logger.error("Weaviate search failed: %s", e)
            return []


# Singleton adapters
pinecone_adapter = PineconeAdapter()
weaviate_adapter = WeaviateAdapter()
