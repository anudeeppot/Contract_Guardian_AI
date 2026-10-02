# Contract Guardian AI

**Enterprise AI-Powered Contract Risk Analysis & Polyglot Microservices Platform**

---

## 🌟 Executive Overview

**Contract Guardian AI** is an enterprise-grade contract analysis and risk mitigation platform. Users upload legal agreements (PDF, DOCX, TXT), and the system automatically extracts text, performs semantic chunking, detects high-risk clauses, identifies deceptive or fraudulent patterns, computes multidimensional risk scores (0–100), suggests safer legal alternatives, and generates comprehensive audit reports.

Built as an enterprise polyglot microservices architecture implementing **Course Outcomes CO1 through CO6**.

---

## 🏗️ Architecture & Course Outcomes (CO1 – CO6)

| Outcome | Focus Area | Technologies & Implementations |
|---|---|---|
| **CO1** | **Relational DBMS & Advanced SQL** | PostgreSQL, 3NF schema, PK/FK/CHECK/UNIQUE constraints, ACID transactions, atomic rollback, Window functions (`ROW_NUMBER`, `RANK`), CTEs, correlated subqueries, multi-table Joins, Triggers, Views, and Indexing strategies (B-Tree, GIN, Partial). |
| **CO2** | **NoSQL & Vector Databases** | MongoDB (Motor async driver) for flexible activity logs & audit sessions, pgvector / HNSW cosine similarity search, recursive text chunking, and deterministic/semantic vector embeddings. |
| **CO3** | **Backend Architecture & RESTful APIs** | Python FastAPI, Pydantic data validation with camelCase aliases, JWT auth with refresh token rotation, bcrypt password hashing, structured error handling, OpenAPI/Swagger docs, and pytest test suite. |
| **CO4** | **Microservices Architecture** | Polyglot microservices: Python FastAPI (port 8000), Node.js/Express Activity Service (port 3001), Spring Boot Report Service (port 8082), and .NET Core 8 API Gateway (port 5000). |
| **CO5** | **System Design & Enterprise Patterns** | In-memory TTL caching, Token Bucket rate limiting, circuit breaker pattern (CLOSED -> OPEN -> HALF-OPEN), async background task execution, and event loop concurrency models. |
| **CO6** | **DevOps, Cloud & Observability** | Multi-container Docker Compose, Kubernetes manifests (Deployments, Services, ConfigMaps, Secrets, Ingress, Probes), GitHub Actions CI/CD pipeline, and Prometheus metrics scraping. |

---

## 🚀 Quick Start & Automated Verification

### 1. Run Complete Automated Verification Suite
Verifies all 6 Course Outcomes (CO1 through CO6) with live database, vector, auth, and system design assertions:
```bash
python scripts/testing/verify_all_outcomes.py
```
*Expected Result: 28 PASSED, 0 FAILED.*

### 2. Run Backend Tests (Pytest)
```bash
cd backend
python -m pytest tests/test_full_suite.py tests/test_ai_analysis.py tests/test_clause_detection.py -v
```
*Expected Result: 34 tests passed.*

### 3. Run Node.js Microservice Tests (Jest)
```bash
cd services/node-activity
npm test
```
*Expected Result: 4 tests passed.*

### 4. Build Frontend (React + TypeScript + Vite)
```bash
cd frontend
npm run build
```
*Expected Result: Clean build in ~2.8s.*

---

## 🐳 Docker Compose (Full Stack Deployment)

Start all services including databases, backend, microservices, frontend, and monitoring:

```bash
docker compose up --build
```

### Exposed Endpoints & Ports:
- **Frontend Web UI**: [http://localhost:8080](http://localhost:8080)
- **FastAPI Core Backend & Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Node.js Activity Microservice**: [http://localhost:3001](http://localhost:3001)
- **Spring Boot Report Microservice**: [http://localhost:8082](http://localhost:8082)
- **.NET Core 8 API Gateway**: [http://localhost:5000](http://localhost:5000)
- **Prometheus Metrics**: [http://localhost:9090](http://localhost:9090)
- **PostgreSQL + pgvector**: `localhost:5432`
- **MongoDB**: `localhost:27017`

---

## 📁 Repository Structure

```text
CONTRACT-GUARDIAN-AI/
├── backend/                       # Python FastAPI core analysis service (CO1, CO2, CO3, CO5)
│   ├── app/                       # api, core, db, schemas, services (vector store, AI analysis)
│   ├── migrations/                # Alembic migrations
│   └── tests/                     # pytest suite
├── frontend/                      # React 18 + TypeScript + Vite SPA (CO3, CO6)
├── database/
│   ├── sql/                       # Schema, indexes, views/triggers/functions, advanced queries (CO1)
│   ├── seeds/                     # Seed data
│   └── mongodb/                   # Mongo schemas, indexes, seeds (placeholders)
├── services/                      # Polyglot microservices (CO4)
│   ├── dotnet-gateway/            # .NET 8 gateway & upstream dispatcher
│   ├── node-activity/             # Node.js/Express activity & audit service (Jest)
│   └── springboot-contract/       # Spring Boot enterprise report service
├── vector/                        # Vector / RAG notes (embeddings, search, rag placeholders)
├── kubernetes/manifests/          # Deployments, Services, Ingress (CO6)
├── monitoring/                    # prometheus/, grafana/, otel/ (CO6)
├── scripts/
│   ├── setup/                     # deploy-local / stop-local (sh, ps1)
│   └── testing/                   # verify_all_outcomes.py (CO1-CO6 runner)
├── tests/                         # Test index (see tests/README.md)
├── docs/                          # Architecture, CO status, presentation
├── demo/                          # Sample contracts for demos
├── .github/workflows/ci-cd.yml    # GitHub Actions CI/CD (CO6)
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## 🧪 Testing Summary

- **Backend Pytest**: 34 unit & integration tests passing (Auth, Contracts, Vector Store, Analytics, Heuristic Analysis, Clause Detection).
- **Node.js Activity Tests**: 4 Jest tests passing with coverage.
- **Frontend TypeScript/Vite**: Zero build errors, strict typechecking.
- **CO1-CO6 Verification Suite**: 28 automated checks passing covering all syllabus outcomes.
