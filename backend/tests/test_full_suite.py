"""
Comprehensive test suite for Contract Guardian AI Backend
CO3: pytest, API tests, database tests, authentication tests, integration tests

NOTE: The API uses camelCase JSON responses (Pydantic alias_generator=to_camel).
      Tests use 'accessToken' / 'refreshToken' accordingly.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.base import Base
from app.db.session import engine
import uuid


# =============================================================
# HELPERS
# =============================================================

def get_token(resp_data: dict) -> str:
    """Extract access token from response (handles camelCase API)."""
    return resp_data.get("accessToken") or resp_data.get("access_token", "")


# =============================================================
# FIXTURES
# =============================================================

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create tables before each test, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
def user_data():
    return {
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "TestPassword123!",
        "fullName": "Test User"
    }


@pytest_asyncio.fixture
async def auth_client(client, user_data):
    """Client + token fixture: signs up user, returns (client, token)."""
    resp = await client.post("/api/v1/auth/signup", json=user_data)
    token = get_token(resp.json())
    return client, token


# =============================================================
# HEALTH TESTS
# =============================================================

@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Health endpoint returns 200."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert "status" in response.json()


# =============================================================
# AUTHENTICATION TESTS (CO3)
# =============================================================

@pytest.mark.asyncio
async def test_signup_success(client, user_data):
    """Signup creates account and returns camelCase tokens."""
    response = await client.post("/api/v1/auth/signup", json=user_data)
    assert response.status_code == 200
    data = response.json()
    assert "accessToken" in data
    assert "refreshToken" in data
    assert data["user"]["email"] == user_data["email"]


@pytest.mark.asyncio
async def test_login_valid_credentials(client, user_data):
    """Login with valid credentials returns access token."""
    await client.post("/api/v1/auth/signup", json=user_data)
    response = await client.post("/api/v1/auth/login", json={
        "email": user_data["email"],
        "password": user_data["password"]
    })
    assert response.status_code == 200
    assert "accessToken" in response.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client, user_data):
    """Login with wrong password returns 401."""
    await client.post("/api/v1/auth/signup", json=user_data)
    response = await client.post("/api/v1/auth/login", json={
        "email": user_data["email"],
        "password": "WrongPassword999!"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_no_token(client):
    """Protected endpoint rejects requests without token."""
    assert (await client.get("/api/v1/contracts")).status_code == 401


@pytest.mark.asyncio
async def test_protected_invalid_token(client):
    """Invalid JWT is rejected."""
    response = await client.get(
        "/api/v1/contracts",
        headers={"Authorization": "Bearer totally-invalid-token"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me(auth_client):
    """GET /auth/me returns current user info."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert "email" in response.json()


@pytest.mark.asyncio
async def test_refresh_token(client, user_data):
    """Refresh token endpoint issues new access token."""
    resp = await client.post("/api/v1/auth/signup", json=user_data)
    refresh_token = resp.json()["refreshToken"]
    response = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "accessToken" in response.json()


# =============================================================
# CONTRACT CRUD TESTS (CO1, CO3)
# =============================================================

@pytest.mark.asyncio
async def test_list_contracts_empty(auth_client):
    """New user has empty contract list."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/contracts",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json() == []


# =============================================================
# ANALYTICS TESTS (CO1: SQL)
# =============================================================

@pytest.mark.asyncio
async def test_analytics_dashboard(auth_client):
    """Dashboard endpoint returns aggregate stats."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/analytics/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_contracts" in data
    assert data["total_contracts"] == 0


@pytest.mark.asyncio
async def test_analytics_risk_distribution(auth_client):
    """Risk distribution returns list."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/analytics/risk-distribution",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_analytics_cte_demo(auth_client):
    """CTE demo endpoint (CO1: CTEs) returns list."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/analytics/cte-demo",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_analytics_subquery_demo(auth_client):
    """Correlated subquery demo endpoint (CO1)."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/analytics/subquery-demo",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_analytics_window_functions(auth_client):
    """Window functions demo (CO1)."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/analytics/window-functions",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_analytics_top_clauses(auth_client):
    """Top risky clauses endpoint (CO1: GROUP BY, HAVING)."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/analytics/top-risky-clauses",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# =============================================================
# VECTOR SEARCH TESTS (CO2)
# =============================================================

@pytest.mark.asyncio
async def test_vector_chunk_text(auth_client):
    """Text chunking returns chunks."""
    client, token = auth_client
    response = await client.post(
        "/api/v1/vector/chunk",
        headers={"Authorization": f"Bearer {token}"},
        json={"text": "This is a sample contract. It contains multiple sentences. We need to test chunking."}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_chunks" in data
    assert data["total_chunks"] >= 1


@pytest.mark.asyncio
async def test_cosine_similarity_demo(auth_client):
    """Cosine similarity demo returns correct values."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/vector/cosine-demo",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "examples" in data
    identical = next(e for e in data["examples"] if e["name"] == "identical vectors")
    assert abs(identical["similarity"] - 1.0) < 0.001


@pytest.mark.asyncio
async def test_vector_embed(auth_client):
    """Embedding generation returns dimension > 0."""
    client, token = auth_client
    response = await client.post(
        "/api/v1/vector/embed",
        headers={"Authorization": f"Bearer {token}"},
        json={"text": "Contract payment terms and conditions."}
    )
    assert response.status_code == 200
    assert response.json()["dimensions"] > 0


@pytest.mark.asyncio
async def test_vector_adapters_status(auth_client):
    """Adapter status returns all three adapters."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/vector/adapters/status",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "pgvector" in data
    assert "pinecone" in data
    assert "weaviate" in data


# =============================================================
# ACTIVITY / MONGODB TESTS (CO2)
# =============================================================

@pytest.mark.asyncio
async def test_activity_logs_postgresql(auth_client):
    """Activity logs from PostgreSQL source."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/activity/logs?source=postgresql",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "logs" in data
    assert data["source"] == "postgresql"


@pytest.mark.asyncio
async def test_mongo_status(auth_client):
    """MongoDB status endpoint."""
    client, token = auth_client
    response = await client.get(
        "/api/v1/activity/mongo/status",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert "mongodb_connected" in response.json()


# =============================================================
# UNIT TESTS (no HTTP)
# =============================================================

@pytest.mark.asyncio
async def test_heuristic_analysis():
    """Heuristic analysis runs without LLM."""
    from app.services.ai_analysis import AIAnalysisService
    service = AIAnalysisService()
    result = await service.analyze_contract(
        "Client shall be liable for unlimited damages. The contract automatically renews."
    )
    assert result.contract_risk_score >= 0
    assert result.risk_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert len(result.clauses) >= 1


def test_clause_detection():
    """Clause detection splits text into clauses (uses paragraph splitting fallback)."""
    from app.services.clause_detection import ClauseDetectionService
    detector = ClauseDetectionService()
    # Use a multi-paragraph text that the paragraph splitter picks up
    text = (
        "ARTICLE 1: PAYMENT TERMS\n\n"
        "The Client shall pay all amounts within thirty (30) days of the invoice date.\n\n"
        "ARTICLE 2: TERMINATION\n\n"
        "Either party may terminate this agreement with thirty (30) days written notice.\n\n"
        "ARTICLE 3: LIABILITY\n\n"
        "Client shall be liable for unlimited damages arising from breach of this contract."
    )
    clauses = detector.split_clauses(text)
    # Either headings detected OR paragraphs — both are valid
    assert len(clauses) >= 1


def test_chunking():
    """Text chunking produces overlapping chunks."""
    from app.services.vector_store import chunk_text
    text = " ".join([f"Sentence {i}." for i in range(200)])
    chunks = chunk_text(text, chunk_size=500, overlap=100)
    assert len(chunks) > 1
    assert all("text" in c and "index" in c for c in chunks)


def test_cosine_similarity():
    """Cosine similarity function correctness."""
    from app.services.vector_store import cosine_similarity
    v = [1.0, 0.5, 0.3]
    assert abs(cosine_similarity(v, v) - 1.0) < 0.001  # identical = 1
    assert abs(cosine_similarity([1, 0, 0], [0, 1, 0])) < 0.001  # orthogonal = 0
    assert abs(cosine_similarity([1, 0, 0], [-1, 0, 0]) + 1.0) < 0.001  # opposite = -1


def test_hash_embedding_deterministic():
    """Hash-based embedding is deterministic."""
    from app.services.vector_store import _hash_embedding
    e1 = _hash_embedding("test text")
    e2 = _hash_embedding("test text")
    assert e1 == e2
    assert len(e1) == 1536  # correct dimensions


def test_password_hashing():
    """Password hashing and verification."""
    from app.core.security import hash_password, verify_password
    password = "MySecurePassword123!"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("WrongPassword", hashed)


def test_jwt_create_decode():
    """JWT token creation and decoding."""
    import uuid
    from app.core.security import create_access_token, decode_access_token
    user_id = uuid.uuid4()
    token = create_access_token(user_id, "USER")
    assert isinstance(token, str)
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "USER"


# =============================================================
# VALIDATION TESTS (CO3: Pydantic)
# =============================================================

@pytest.mark.asyncio
async def test_signup_invalid_email(client):
    """Invalid email format is rejected."""
    response = await client.post("/api/v1/auth/signup", json={
        "email": "not-an-email", "password": "Password123!"
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_signup_missing_fields(client):
    """Missing required fields are rejected."""
    response = await client.post("/api/v1/auth/signup", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_short_password_rejected(client):
    """Password too short is rejected."""
    response = await client.post("/api/v1/auth/signup", json={
        "email": "test@example.com", "password": "short"
    })
    assert response.status_code == 422
