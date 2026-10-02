"""
Activity logging service for Contract Guardian AI.
CO2: MongoDB integration for document-oriented activity storage.
CO1: PostgreSQL activity_logs table for relational audit trail.
"""
import logging
from datetime import datetime, UTC
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ActivityLog
from app.db.mongo import get_activity_collection

logger = logging.getLogger(__name__)


class ActivityService:
    """
    Polyglot activity logging:
    - PostgreSQL: relational audit trail (CO1)
    - MongoDB: flexible document storage with richer metadata (CO2)
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        activity_type: str,
        user_id: UUID | None = None,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        description: str = "",
        ip_address: str | None = None,
        user_agent: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        """Log activity to both PostgreSQL and MongoDB."""
        metadata = metadata or {}

        # 1. PostgreSQL (relational - CO1)
        try:
            log = ActivityLog(
                user_id=user_id,
                activity_type=activity_type,
                entity_type=entity_type,
                entity_id=entity_id,
                description=description,
                ip_address=ip_address,
                user_agent=user_agent,
                log_metadata=metadata,
            )
            self.db.add(log)
            await self.db.flush()
        except Exception as e:
            logger.warning("Failed to write activity to PostgreSQL: %s", e)

        # 2. MongoDB (document - CO2)
        await self._log_to_mongo(
            activity_type=activity_type,
            user_id=str(user_id) if user_id else None,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )

    async def _log_to_mongo(self, **kwargs) -> None:
        """Write activity document to MongoDB."""
        try:
            collection = await get_activity_collection()
            if collection is None:
                return
            doc = {
                **kwargs,
                "created_at": datetime.now(UTC),
                "source": "contract_guardian_api",
            }
            await collection.insert_one(doc)
        except Exception as e:
            logger.debug("MongoDB activity log failed: %s", e)

    async def get_user_activity(
        self, user_id: UUID, limit: int = 50, from_mongo: bool = False
    ) -> list[dict]:
        """Retrieve user activity from PostgreSQL or MongoDB."""
        if from_mongo:
            return await self._get_from_mongo(str(user_id), limit)
        return await self._get_from_postgres(user_id, limit)

    async def _get_from_postgres(self, user_id: UUID, limit: int) -> list[dict]:
        from sqlalchemy import select, desc
        result = await self.db.execute(
            select(ActivityLog)
            .where(ActivityLog.user_id == user_id)
            .order_by(desc(ActivityLog.created_at))
            .limit(limit)
        )
        logs = result.scalars().all()
        return [
            {
                "id": log.id,
                "activity_type": log.activity_type,
                "entity_type": log.entity_type,
                "entity_id": str(log.entity_id) if log.entity_id else None,
                "description": log.description,
                "created_at": log.created_at.isoformat(),
                "metadata": log.log_metadata,
                "source": "postgresql",
            }
            for log in logs
        ]

    async def _get_from_mongo(self, user_id: str, limit: int) -> list[dict]:
        try:
            collection = await get_activity_collection()
            if collection is None:
                return []
            cursor = collection.find(
                {"user_id": user_id},
                {"_id": 0}
            ).sort("created_at", -1).limit(limit)
            docs = await cursor.to_list(length=limit)
            for doc in docs:
                doc["source"] = "mongodb"
                if isinstance(doc.get("created_at"), datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
            return docs
        except Exception as e:
            logger.warning("MongoDB activity fetch failed: %s", e)
            return []

    async def get_aggregated_stats(self) -> dict:
        """
        MongoDB aggregation pipeline for activity statistics.
        CO2: Demonstrates MongoDB aggregation pipeline.
        """
        try:
            collection = await get_activity_collection()
            if collection is None:
                return {}

            pipeline = [
                # Stage 1: Group by activity type
                {
                    "$group": {
                        "_id": "$activity_type",
                        "count": {"$sum": 1},
                        "unique_users": {"$addToSet": "$user_id"},
                        "last_activity": {"$max": "$created_at"},
                    }
                },
                # Stage 2: Project clean output
                {
                    "$project": {
                        "activity_type": "$_id",
                        "count": 1,
                        "unique_user_count": {"$size": "$unique_users"},
                        "last_activity": 1,
                        "_id": 0,
                    }
                },
                # Stage 3: Sort by count descending
                {"$sort": {"count": -1}},
            ]

            result = await collection.aggregate(pipeline).to_list(length=100)
            return {"by_type": result, "source": "mongodb_aggregation"}
        except Exception as e:
            logger.warning("MongoDB aggregation failed: %s", e)
            return {}
