"""
Activity and MongoDB API (CO2).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import current_user
from app.db.models import User
from app.db.session import get_db
from app.db.mongo import ping_mongo, get_mongo_db
from app.services.activity import ActivityService

router = APIRouter(prefix="/activity", tags=["Activity & MongoDB (CO2)"])


@router.get("/logs")
async def get_activity_logs(
    limit: int = Query(50, ge=1, le=200),
    source: str = Query("postgresql", pattern="^(postgresql|mongodb)$"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get user activity logs from PostgreSQL or MongoDB.
    CO2: Polyglot persistence demonstration.
    """
    service = ActivityService(db)
    logs = await service.get_user_activity(
        user.id, limit=limit, from_mongo=(source == "mongodb")
    )
    return {"source": source, "count": len(logs), "logs": logs}


@router.get("/stats")
async def get_activity_stats(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Activity statistics via MongoDB aggregation pipeline.
    CO2: MongoDB aggregation pipeline demonstration.
    """
    service = ActivityService(db)
    stats = await service.get_aggregated_stats()
    return stats


@router.get("/mongo/status")
async def mongo_status(user: User = Depends(current_user)):
    """Check MongoDB connectivity status."""
    is_connected = await ping_mongo()
    return {
        "mongodb_connected": is_connected,
        "description": "MongoDB used for document-oriented activity storage (CO2 polyglot persistence)",
    }


@router.get("/mongo/collections")
async def get_mongo_collections(user: User = Depends(current_user)):
    """
    List MongoDB collections and document counts.
    CO2: MongoDB BSON document storage.
    """
    try:
        db = get_mongo_db()
        if db is None:
            return {"error": "MongoDB not connected", "collections": []}
        names = await db.list_collection_names()
        result = []
        for name in names:
            count = await db[name].count_documents({})
            result.append({"collection": name, "document_count": count})
        return {"database": db.name, "collections": result}
    except Exception as e:
        return {"error": str(e), "collections": []}


@router.post("/mongo/demo-crud")
async def mongo_crud_demo(user: User = Depends(current_user)):
    """
    MongoDB CRUD demonstration.
    CO2: Insert, find, update, delete documents.
    """
    try:
        db = get_mongo_db()
        if db is None:
            return {"error": "MongoDB not connected"}

        demo_collection = db["demo_crud"]

        # CREATE - Insert document
        doc = {
            "user_id": str(user.id),
            "action": "demo",
            "data": {"text": "Contract Guardian AI MongoDB Demo", "value": 42},
            "tags": ["demo", "mongodb", "crud"],
        }
        insert_result = await demo_collection.insert_one(doc)
        inserted_id = str(insert_result.inserted_id)

        # READ - Find document
        from bson import ObjectId
        found = await demo_collection.find_one({"_id": ObjectId(inserted_id)})
        found_clean = {k: str(v) if k == "_id" else v for k, v in found.items()}

        # UPDATE - Modify document
        await demo_collection.update_one(
            {"_id": ObjectId(inserted_id)},
            {"$set": {"data.updated": True}, "$push": {"tags": "updated"}}
        )

        # READ after update
        updated = await demo_collection.find_one({"_id": ObjectId(inserted_id)})
        updated_clean = {k: str(v) if k == "_id" else v for k, v in updated.items()}

        # DELETE - Remove document
        await demo_collection.delete_one({"_id": ObjectId(inserted_id)})

        return {
            "operations": ["INSERT", "FIND", "UPDATE", "DELETE"],
            "inserted_id": inserted_id,
            "found_document": found_clean,
            "updated_document": updated_clean,
            "deleted": True,
            "note": "All BSON CRUD operations completed successfully",
        }
    except Exception as e:
        return {"error": str(e)}
