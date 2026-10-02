# Contract Guardian AI — Architecture & CO1-CO6 Implementation Map

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     React / Vite Frontend                        │
│             (TypeScript, Tailwind, Chart.js)                     │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTP / REST / WS
              ┌───────────▼───────────────┐
              │  .NET 8 API Gateway       │  ← CO4, CO5
              │  (YARP, Routing, CORS)    │
              └───────┬───────┬───────────┘
                      │       │
          ┌───────────▼──┐  ┌─▼────────────────┐
          │  FastAPI      │  │  Node.js Express  │  ← CO4, CO5
          │  Backend      │  │  Activity Service  │
          │  (Python 3.12)│  │  (Socket.io, JWT) │
          └──────┬────────┘  └────────┬──────────┘
                 │                    │
     ┌───────────▼────────────────────▼──────────┐
     │  ┌─────────────┐  ┌──────────────────────┐ │
     │  │ PostgreSQL   │  │  MongoDB 7           │ │
     │  │ + pgvector  │  │  (Motor async)        │ │  ← CO1, CO2
     │  │ (Primary DB) │  │  (Document store)    │ │
     │  └─────────────┘  └──────────────────────┘ │
     │           DBMS Layer                         │
     └──────────────────────────────────────────────┘
```

---

## CO1 — Relational Database Engineering

### Schema Design (3NF)
| Table | Key Relationships |
|-------|-------------------|
| `users` | Primary table |
| `contracts` | FK → users |
| `contract_versions` | FK → contracts |
| `analyses` | FK → contracts, users |
| `clause_analyses` | FK → analyses |
| `risk_findings` | FK → analyses |
| `contract_embeddings` | FK → contracts |
| `activity_logs` | FK → users |
| `reports` | FK → contracts, analyses, users |
| `tags` | Independent |
| `contract_tags` | Many-to-many: contracts ↔ tags |
| `refresh_tokens` | FK → users |
| `payments` | FK → users |

### SQL Features Implemented

| Feature | File | Example |
|---------|------|---------|
| DDL (CREATE TABLE, ENUM, INDEXES) | `database/sql/01_schema.sql` | All tables with constraints |
| B-Tree Indexes | `database/sql/02_indexes.sql` | `idx_contracts_user_id` |
| GIN (Full-text) | `database/sql/02_indexes.sql` | `idx_contracts_text_search` |
| Trigram | `database/sql/02_indexes.sql` | `idx_contracts_title_trgm` |
| HNSW (vector) | `database/sql/02_indexes.sql` | `idx_embeddings_hnsw` |
| Complex Views | `database/sql/03_views_triggers_functions.sql` | `v_contract_dashboard`, `v_risk_summary` |
| Triggers | `database/sql/03_views_triggers_functions.sql` | `trg_log_contract_upload` |
| Stored Procedures | `database/sql/03_views_triggers_functions.sql` | `fn_contract_stats` |
| INNER JOIN | `database/sql/04_advanced_queries.sql` | Contracts + analyses |
| LEFT JOIN | `database/sql/04_advanced_queries.sql` | All contracts including unanalyzed |
| Multi-table JOIN | `database/sql/04_advanced_queries.sql` | users + contracts + analyses + clauses |
| Subquery | `database/sql/04_advanced_queries.sql` | Above-average risk |
| Correlated Subquery | `database/sql/04_advanced_queries.sql` | Latest analysis per contract |
| CTE | `database/sql/04_advanced_queries.sql` | `WITH user_risk_stats AS...` |
| Recursive CTE | `database/sql/04_advanced_queries.sql` | Clause hierarchy |
| Window Functions | `database/sql/04_advanced_queries.sql` | ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD |
| GROUP BY + HAVING | `database/sql/04_advanced_queries.sql` | High-risk clause patterns |
| CASE Expressions | `database/sql/04_advanced_queries.sql` | Risk recommendations |
| DML (INSERT/UPDATE/DELETE) | `database/sql/04_advanced_queries.sql`, `database/seeds/01_seed_data.sql` |
| ACID / Transactions | `database/sql/04_advanced_queries.sql` | SAVEPOINT demo |
| MVCC | `database/sql/04_advanced_queries.sql` | Isolation levels demo |
| Alembic Migrations | `backend/migrations/versions/0002_full_schema.py` | Full schema migration |

### API Analytics Endpoints (Live SQL)
- `GET /api/v1/analytics/dashboard` — GROUP BY + aggregates
- `GET /api/v1/analytics/risk-distribution` — GROUP BY + CASE
- `GET /api/v1/analytics/top-risky-clauses` — GROUP BY + HAVING
- `GET /api/v1/analytics/window-functions` — RANK, DENSE_RANK, ROW_NUMBER, LAG, LEAD
- `GET /api/v1/analytics/cte-demo` — Multi-step CTEs
- `GET /api/v1/analytics/subquery-demo` — Correlated subqueries
- `GET /api/v1/analytics/catalog` — information_schema catalog query

---

## CO2 — SQL/NoSQL/Vector Databases

### PostgreSQL (Relational)
- Primary data store for all structured contract data
- **pgvector extension**: HNSW index for ANN (Approximate Nearest Neighbor) search
- Full-text search via `tsvector` + GIN indexes

### MongoDB (Document)
- Activity logs with flexible metadata (embedding pattern)
- Analysis cache by contract SHA-256
- RAG session history
- **Demonstrated**: BSON CRUD, aggregation pipeline, indexes
- **Adapter**: `app/db/mongo.py` + `app/api/v1/activity.py`

### Vector Search (CO2)
| Feature | Implementation |
|---------|---------------|
| Chunking | `chunk_text()` with sentence-aware overlapping |
| Embedding | OpenAI `text-embedding-3-small` or hash fallback |
| Storage | `contract_embeddings` table (JSON or pgvector) |
| Search | Cosine similarity, HNSW ANN |
| Hybrid | 70% vector + 30% keyword (BM25-style) |
| RAG | Retrieve chunks → LLM context → Answer |
| Pinecone | `PineconeAdapter` (interchangeable) |
| Weaviate | `WeaviateAdapter` (interchangeable) |

### API Endpoints
- `POST /api/v1/vector/index` — Chunk + embed + store
- `POST /api/v1/vector/search` — Semantic / hybrid search
- `POST /api/v1/vector/rag/query` — RAG pipeline
- `POST /api/v1/vector/embed` — Generate embedding
- `POST /api/v1/vector/chunk` — Demo chunking
- `GET /api/v1/vector/cosine-demo` — Cosine similarity demo
- `GET /api/v1/vector/adapters/status` — pgvector / Pinecone / Weaviate status

---

## CO3 — Backend API Engineering (FastAPI)

| Feature | File |
|---------|------|
| REST API | `backend/app/api/v1/` |
| JWT Authentication | `app/core/security.py` |
| RBAC | `app/api/dependencies.py` → `require_role()` |
| Request Validation | Pydantic v2 schemas |
| Error handling | Custom `AppError`, 422 handler, 500 handler |
| Rate limiting | `rate_limit_enabled` config (middleware) |
| CORS | CORSMiddleware |
| OpenAPI docs | `/docs` (Swagger UI), `/redoc` |
| Prometheus | `/metrics` endpoint |
| Request ID | `X-Request-ID` header |
| Testing | pytest + httpx AsyncClient, 30+ tests |

---

## CO4 — Multi-Framework Backend

| Framework | Service | Language | Port |
|-----------|---------|----------|------|
| FastAPI | Main Backend | Python 3.12 | 8000 |
| Express.js | Activity Service | Node.js 20 | 3001 |
| Spring Boot 3.2 | Report Service | Java 20 | 8082 |
| ASP.NET Core 8 | API Gateway | .NET 8 | 5000 |

### Framework-specific Features Demonstrated
- **FastAPI**: async/await, Pydantic v2, SQLAlchemy 2.0, Alembic, middleware
- **Express.js**: Middleware chain, Socket.io, Mongoose, Joi validation, Winston logging, Rate limiting
- **Spring Boot**: IoC/DI (@Autowired), JPA/Hibernate, @Async, Bean Validation, Actuator, OpenAPI, SecurityConfig
- **.NET Core**: EF Core, ASP.NET Identity, JWT, Swagger, YARP reverse proxy, Minimal APIs

---

## CO5 — Microservices Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Microservices Mesh                            │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Contract         │  │  Analysis         │  │  Vector/RAG   │  │
│  │  Service          │  │  Service          │  │  Service      │  │
│  │  (Contracts CRUD) │  │  (AI Risk Score)  │  │  (Embeddings) │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Report           │  │  Activity         │  │  Auth         │  │
│  │  Service          │  │  Service          │  │  Service      │  │
│  │  (Spring Boot)    │  │  (Node.js)        │  │  (FastAPI)    │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              .NET API Gateway                            │   │
│  │  (Routing, Auth forwarding, Health aggregation)          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

Each service:
- Has its own technology stack
- Communicates via HTTP REST
- Has independent health checks
- Has independent database schema/collection

---

## CO6 — Deployment & Observability

### Docker
- Multi-service `docker-compose.yml` with health checks
- Named volumes for data persistence
- Service dependency ordering
- Environment variable injection
- Separate network: `contract-guardian-net`

### Kubernetes
- Namespace: `contract-guardian`
- ConfigMap for non-sensitive config
- Secret template for credentials
- Deployments with replicas, resource limits
- Health probes (readiness + liveness)
- PersistentVolumeClaims for databases
- Ingress with nginx

### CI/CD (GitHub Actions)
- Backend tests (pytest) with PostgreSQL service
- Frontend build
- Node.js microservice tests
- Security scanning (Trivy + TruffleHog)
- Docker image builds
- Pipeline summary report

### Observability
- **Prometheus**: `/metrics` endpoint + `monitoring/prometheus/prometheus.yml`
- **Grafana**: Dashboard provisioning in `monitoring/grafana/`
- **OpenTelemetry**: Configurable OTEL tracing (SDK + OTLP exporter)
- **Logging**: Structured JSON logging (Winston in Node.js, Python logging)
- **Request tracing**: X-Request-ID header on all responses
- **Health checks**: `/health` on all services

---

## Running the Project

### Quick Start (SQLite, no Docker needed)
```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL to: sqlite+aiosqlite:///./contract_guardian.db
pip install -e ".[test]"
pip install motor pymongo prometheus-client
python -m pytest tests/test_full_suite.py -v
uvicorn app.main:app --reload --port 8000
```

### With PostgreSQL + MongoDB (Docker)
```bash
docker-compose up -d
# Backend auto-runs alembic migrations
# Access: http://localhost:8080 (frontend), http://localhost:8000/docs (API)
```

### Node.js Activity Service
```bash
cd services/node-activity
cp .env.example .env
npm install
npm start
# Running on http://localhost:3001
```

### Kubernetes (requires kubectl + local cluster)
```bash
kubectl apply -f kubernetes/manifests/k8s-manifests.yml
kubectl get pods -n contract-guardian
```
