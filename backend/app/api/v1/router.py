from fastapi import APIRouter

from app.api.v1 import analysis, auth, contracts, health, reports
from app.api.v1 import analytics, vector, activity

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(contracts.router)
api_router.include_router(analysis.router)
api_router.include_router(reports.router)
# CO1: Advanced SQL Analytics
api_router.include_router(analytics.router)
# CO2: Vector Search & RAG
api_router.include_router(vector.router)
# CO2: Activity Logs & MongoDB
api_router.include_router(activity.router)
