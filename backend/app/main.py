import uuid
import time
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import configure_logging
from app.db.base import Base
from app.db import models as _models  # noqa: F401 — registers all ORM models with Base.metadata
from app.db.session import engine

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    description=(
        "Contract Guardian AI - Enterprise Contract Analysis Platform. "
        "Implements CO1 (PostgreSQL/SQL), CO2 (MongoDB/Vector/RAG), "
        "CO3 (FastAPI/JWT/RBAC), CO4 (Multi-framework), "
        "CO5 (Microservices), CO6 (Docker/K8s/Observability)."
    ),
    default_response_class=ORJSONResponse,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "Authentication", "description": "JWT auth, signup, login, refresh tokens (CO3)"},
        {"name": "Contracts", "description": "Contract CRUD operations (CO1, CO3)"},
        {"name": "Analysis", "description": "AI-powered contract risk analysis (CO3)"},
        {"name": "Analytics (CO1 SQL)", "description": "Advanced SQL analytics: CTEs, window functions, aggregates"},
        {"name": "Vector Search & RAG (CO2)", "description": "pgvector, embeddings, RAG pipeline"},
        {"name": "Activity & MongoDB (CO2)", "description": "Polyglot persistence: PostgreSQL + MongoDB"},
        {"name": "Reports", "description": "PDF report generation"},
        {"name": "Health", "description": "Health checks and service status"},
    ],
)


# =============================================================
# MIDDLEWARE
# =============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequestMetricsMiddleware(BaseHTTPMiddleware):
    """Track request metrics for Prometheus (CO6)."""
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        # Add timing header
        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
        response.headers["X-Request-ID"] = request.headers.get(
            "x-request-id", f"req_{uuid.uuid4().hex[:12]}"
        )
        return response


app.add_middleware(RequestMetricsMiddleware)
app.include_router(api_router, prefix=settings.api_v1_prefix)


# =============================================================
# STARTUP & SHUTDOWN
# =============================================================

@app.on_event("startup")
async def startup():
    logger.info("Starting Contract Guardian AI v2.0")

    # Create tables (dev mode; prod uses alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized")

    # Initialize MongoDB indexes
    from app.db.mongo import ensure_mongo_indexes, ping_mongo
    mongo_ok = await ping_mongo()
    if mongo_ok:
        await ensure_mongo_indexes()
        logger.info("MongoDB connected and indexes ensured")
    else:
        logger.warning("MongoDB not available - document features disabled")

    # Initialize OpenTelemetry (CO6)
    if settings.otel_enabled:
        _init_otel()

    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown():
    logger.info("Contract Guardian AI shutting down")
    from app.db.mongo import _mongo_client
    if _mongo_client:
        _mongo_client.close()


def _init_otel():
    """Initialize OpenTelemetry tracing (CO6)."""
    try:
        # pyrefly: ignore [missing-import]
        from opentelemetry import trace
        # pyrefly: ignore [missing-import]
        from opentelemetry.sdk.trace import TracerProvider
        # pyrefly: ignore [missing-import]
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        # pyrefly: ignore [missing-import]
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        # pyrefly: ignore [missing-import]
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        # pyrefly: ignore [missing-import]
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        provider = TracerProvider()
        exporter = OTLPSpanExporter(endpoint=settings.otel_endpoint)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        FastAPIInstrumentor.instrument_app(app)
        logger.info("OpenTelemetry initialized")
    except ImportError:
        logger.warning("OpenTelemetry packages not installed - tracing disabled")
    except Exception as e:
        logger.warning("OpenTelemetry init failed: %s", e)


# =============================================================
# PROMETHEUS METRICS (CO6)
# =============================================================
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
    from starlette.responses import Response as StarletteResponse

    REQUEST_COUNT = Counter(
        "contract_guardian_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status"]
    )
    REQUEST_LATENCY = Histogram(
        "contract_guardian_request_latency_seconds",
        "HTTP request latency",
        ["method", "endpoint"]
    )

    @app.get("/metrics", include_in_schema=False)
    async def prometheus_metrics():
        return StarletteResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    logger.info("Prometheus metrics endpoint enabled at /metrics")
except ImportError:
    logger.info("prometheus_client not installed - metrics endpoint disabled")


# =============================================================
# ERROR HANDLERS
# =============================================================

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    request_id = request.headers.get("x-request-id", f"req_{uuid.uuid4().hex[:12]}")
    detail = exc.detail
    return ORJSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": detail["code"],
                "message": detail["message"],
                "details": detail.get("details", {}),
                "requestId": request_id,
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    request_id = request.headers.get("x-request-id", f"req_{uuid.uuid4().hex[:12]}")
    return ORJSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"errors": exc.errors()},
                "requestId": request_id,
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    request_id = request.headers.get("x-request-id", f"req_{uuid.uuid4().hex[:12]}")
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return ORJSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Unexpected server error",
                "details": {},
                "requestId": request_id,
            }
        },
    )
