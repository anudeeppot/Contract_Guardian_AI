"""
Vector search and RAG API (CO2).
Implements: chunking, embedding, vector storage, similarity search, RAG pipeline.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import current_user
from app.db.models import Contract, User
from app.db.session import get_db
from app.services.vector_store import (
    RAGService,
    PgVectorStore,
    chunk_text,
    cosine_similarity,
    generate_embedding,
    pinecone_adapter,
    weaviate_adapter,
)
from app.services.contracts import ContractService

router = APIRouter(prefix="/vector", tags=["Vector Search & RAG (CO2)"])


class IndexRequest(BaseModel):
    contract_id: str


class SearchRequest(BaseModel):
    query: str
    contract_id: str | None = None
    top_k: int = 5
    use_hybrid: bool = True


class RAGRequest(BaseModel):
    question: str
    contract_id: str | None = None
    top_k: int = 5


class EmbeddingRequest(BaseModel):
    text: str


@router.post("/index")
async def index_contract_embeddings(
    payload: IndexRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Index a contract for vector search.
    CO2: Chunking → Embeddings → Vector Storage.
    """
    contract = await ContractService(db).get_owned(UUID(payload.contract_id), user.id)
    if not contract.extracted_text:
        raise HTTPException(status_code=400, detail="Contract text not extracted. Run extract-text first.")

    rag = RAGService(db)
    result = await rag.index_contract(UUID(payload.contract_id), contract.extracted_text)

    from app.services.activity import ActivityService
    await ActivityService(db).log(
        "VECTOR_SEARCH",
        user_id=user.id,
        entity_type="contract",
        entity_id=UUID(payload.contract_id),
        description=f"Indexed contract for vector search: {result['chunks']} chunks",
        metadata=result,
    )
    await db.commit()

    return {
        "message": "Contract indexed successfully",
        "contract_id": payload.contract_id,
        **result,
    }


@router.post("/search")
async def vector_search(
    payload: SearchRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Semantic / hybrid vector search over contract chunks.
    CO2: Similarity search, Top-K, cosine similarity, hybrid keyword+vector.
    """
    vector_store = PgVectorStore(db)
    contract_id = UUID(payload.contract_id) if payload.contract_id else None

    if payload.use_hybrid:
        results = await vector_store.hybrid_search(
            payload.query, contract_id, payload.top_k
        )
    else:
        results = await vector_store.similarity_search(
            payload.query, contract_id, payload.top_k
        )

    from app.services.activity import ActivityService
    await ActivityService(db).log(
        "VECTOR_SEARCH",
        user_id=user.id,
        description=f"Vector search: '{payload.query[:100]}'",
        metadata={"query": payload.query, "results": len(results)},
    )
    await db.commit()

    return {
        "query": payload.query,
        "results": results,
        "total_found": len(results),
        "search_type": "hybrid" if payload.use_hybrid else "vector",
    }


@router.post("/rag/query")
async def rag_query(
    payload: RAGRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    RAG (Retrieval-Augmented Generation) query.
    CO2: contract chunks → vector search → context → LLM/heuristic answer.
    """
    rag = RAGService(db)
    contract_id = UUID(payload.contract_id) if payload.contract_id else None
    result = await rag.query(payload.question, contract_id, payload.top_k)

    from app.services.activity import ActivityService
    await ActivityService(db).log(
        "RAG_QUERY",
        user_id=user.id,
        description=f"RAG query: '{payload.question[:100]}'",
        metadata={"question": payload.question, "sources": len(result.get("sources", []))},
    )
    await db.commit()

    return result


@router.post("/embed")
async def get_embedding(
    payload: EmbeddingRequest,
    user: User = Depends(current_user),
):
    """
    Generate embedding for arbitrary text.
    CO2: Demonstrates embedding generation.
    """
    embedding = await generate_embedding(payload.text)
    return {
        "text": payload.text[:100] + "..." if len(payload.text) > 100 else payload.text,
        "dimensions": len(embedding) if embedding else 0,
        "embedding_preview": embedding[:10] if embedding else [],
        "model": "openai" if __import__("app.core.config", fromlist=["settings"]).settings.openai_api_key else "hash-fallback",
    }


@router.post("/chunk")
async def chunk_contract_text(
    payload: EmbeddingRequest,
    user: User = Depends(current_user),
):
    """
    Demonstrate text chunking strategy.
    CO2: Chunking for RAG pipeline.
    """
    chunks = chunk_text(payload.text)
    return {
        "total_chunks": len(chunks),
        "chunks": [
            {
                "index": c["index"],
                "text_preview": c["text"][:200],
                "word_count": c["word_count"],
            }
            for c in chunks
        ],
    }


@router.get("/cosine-demo")
async def cosine_similarity_demo(user: User = Depends(current_user)):
    """
    Cosine similarity demonstration.
    CO2: Similarity metrics.
    """
    import math
    vec_a = [1.0, 0.5, 0.3, 0.0, 0.8]
    vec_b = [0.9, 0.6, 0.2, 0.1, 0.7]
    vec_c = [-1.0, -0.5, -0.3, 0.0, -0.8]
    return {
        "explanation": "Cosine similarity measures the angle between two vectors in N-dimensional space",
        "formula": "cos(θ) = (A·B) / (|A|·|B|)",
        "examples": [
            {"name": "similar vectors", "similarity": round(cosine_similarity(vec_a, vec_b), 4)},
            {"name": "identical vectors", "similarity": round(cosine_similarity(vec_a, vec_a), 4)},
            {"name": "opposite vectors", "similarity": round(cosine_similarity(vec_a, vec_c), 4)},
        ],
        "use_case": "Used to find contract chunks most semantically similar to a search query",
    }


@router.get("/adapters/status")
async def get_adapter_status(user: User = Depends(current_user)):
    """
    Check status of all vector store adapters.
    CO2: Pinecone, Weaviate, pgvector availability.
    """
    return {
        "pgvector": {"available": True, "description": "PostgreSQL pgvector extension"},
        "pinecone": {
            "available": pinecone_adapter.is_available(),
            "description": "Pinecone managed vector database",
            "configured": bool(__import__("app.core.config", fromlist=["settings"]).settings.pinecone_api_key),
        },
        "weaviate": {
            "available": weaviate_adapter.is_available(),
            "description": "Weaviate open-source vector database",
            "url": __import__("app.core.config", fromlist=["settings"]).settings.weaviate_url,
        },
    }
