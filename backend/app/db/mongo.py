"""
MongoDB integration for Contract Guardian AI (CO2 - Polyglot Persistence)
Uses Motor (async MongoDB driver) for document-oriented storage.
"""
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# Motor client - initialized lazily
_mongo_client = None
_mongo_db = None


def get_mongo_client():
    """Get or create the Motor async MongoDB client."""
    global _mongo_client
    if _mongo_client is None:
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            _mongo_client = AsyncIOMotorClient(
                settings.mongodb_url,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
            )
            logger.info("MongoDB client initialized: %s", settings.mongodb_url)
        except ImportError:
            logger.warning("motor not installed - MongoDB features disabled")
        except Exception as e:
            logger.warning("MongoDB connection failed: %s", e)
    return _mongo_client


def get_mongo_db():
    """Get the MongoDB database instance."""
    global _mongo_db
    if _mongo_db is None:
        client = get_mongo_client()
        if client:
            _mongo_db = client[settings.mongodb_db]
    return _mongo_db


async def get_activity_collection():
    """Return the activity_logs collection."""
    db = get_mongo_db()
    if db is None:
        return None
    return db["activity_logs"]


async def get_analysis_cache_collection():
    """Return the analysis_cache collection for caching AI results."""
    db = get_mongo_db()
    if db is None:
        return None
    return db["analysis_cache"]


async def get_rag_sessions_collection():
    """Return the rag_sessions collection for RAG conversation history."""
    db = get_mongo_db()
    if db is None:
        return None
    return db["rag_sessions"]


async def ping_mongo() -> bool:
    """Check if MongoDB is reachable."""
    try:
        client = get_mongo_client()
        if client is None:
            return False
        await client.admin.command("ping")
        return True
    except Exception:
        return False


async def ensure_mongo_indexes():
    """Create MongoDB indexes for optimal query performance."""
    try:
        db = get_mongo_db()
        if db is None:
            return

        # Activity logs indexes
        activity = db["activity_logs"]
        await activity.create_index([("user_id", 1), ("created_at", -1)])
        await activity.create_index([("activity_type", 1)])
        await activity.create_index([("contract_id", 1)])
        await activity.create_index([("created_at", -1)])

        # Analysis cache indexes
        cache = db["analysis_cache"]
        await cache.create_index([("contract_sha256", 1)], unique=True, sparse=True)
        await cache.create_index([("created_at", -1)])
        await cache.create_index([("contract_id", 1)])

        # RAG sessions indexes
        rag = db["rag_sessions"]
        await rag.create_index([("user_id", 1), ("contract_id", 1)])
        await rag.create_index([("session_id", 1)], unique=True)
        await rag.create_index([("created_at", -1)])

        logger.info("MongoDB indexes created")
    except Exception as e:
        logger.warning("Could not create MongoDB indexes: %s", e)
