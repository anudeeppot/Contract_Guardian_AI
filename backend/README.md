# Contract Guardian AI Backend

Enterprise-grade FastAPI backend for AI contract risk analysis.

## Features

- JWT signup, login, and refresh token rotation
- PDF, DOCX, and TXT upload with size and signature validation
- Temporary local storage suitable for containerized deployments
- PDF extraction via PyMuPDF
- DOCX extraction via python-docx
- Optional OCR fallback for sparse PDFs
- Clause detection and labeling
- LangChain + OpenAI structured contract analysis
- Deterministic heuristic fallback when OpenAI credentials are absent
- Fraud and abnormal-language detection
- Overall 0-100 risk scoring
- Safer clause rewrites
- JSON, Markdown, and PDF report downloads
- Analysis history
- Swagger/OpenAPI documentation
- PostgreSQL persistence with Alembic migrations
- Docker Compose for local development

## API

Swagger UI:

```text
http://localhost:8000/docs
```

Base API path:

```text
/api/v1
```

## Local Development

```text
cp .env.example .env
docker compose up --build
```

Run migrations:

```text
docker compose exec backend alembic upgrade head
```

## Authentication Flow

1. `POST /api/v1/auth/signup`
2. `POST /api/v1/auth/login`
3. Use `Authorization: Bearer <access_token>`
4. Rotate refresh tokens with `POST /api/v1/auth/refresh`

## Upload And Analyze Flow

1. `POST /api/v1/contracts/upload`
2. `POST /api/v1/contracts/{contract_id}/extract-text`
3. `POST /api/v1/analyze` with x402 payment header
4. `GET /api/v1/contracts/{contract_id}/analysis`
5. `POST /api/v1/download-report` with x402 payment header

## x402 Header

The middleware accepts an `X-PAYMENT` header containing either JSON or base64url-encoded JSON.

Required fields:

```json
{
  "paymentId": "pay_unique_id",
  "amount": "2.00",
  "asset": "USDC",
  "network": "base",
  "receiver": "0xReceiverAddress",
  "resource": "/api/v1/analyze",
  "method": "POST"
}
```

If the header is absent, the API returns `402 PAYMENT_REQUIRED` with accepted payment requirements.

## Tests

```text
pip install -e ".[test]"
pytest
```

## Production Notes

- Replace local file storage with encrypted object storage for multi-instance deployments.
- Set a strong `JWT_SECRET`.
- Use managed PostgreSQL with backups.
- Set `OPENAI_API_KEY`.
- Wire `X402_FACILITATOR_URL` to a production-grade facilitator verifier if required.
- Do not log uploaded contract text or generated legal analysis.
