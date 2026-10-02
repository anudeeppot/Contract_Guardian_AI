# Contract Guardian AI Hackathon Presentation Notes

## 30-Second Pitch

Contract Guardian AI helps teams review legal contracts before signing. Users upload a PDF, DOCX, or TXT agreement, and the system extracts clauses, detects legal and fraud risks, explains the business impact, suggests safer language, and produces a downloadable executive report.

## Problem

Contract review is slow, expensive, and easy to get wrong under time pressure. Small businesses and internal teams often miss hidden obligations, automatic renewals, one-sided liability, and suspicious blanks.

## Solution

Contract Guardian AI provides immediate AI triage:

- Overall contract risk score from 0 to 100
- Clause-by-clause risk analysis
- Fraud and abnormal-language warnings
- Plain-English executive summary
- Safer alternative clause language
- Downloadable JSON, Markdown, and PDF reports
- x402-protected premium AI endpoints

## Demo Flow

1. Open `http://localhost:8080`.
2. Create an account.
3. Upload `demo/sample-risky-contract.txt`.
4. Click `Upload and analyze`.
5. Show the risk dashboard with critical clauses.
6. Open the report page and download JSON or PDF.
7. Explain that the AI endpoints are protected by x402 middleware.

## Architecture

- Frontend: React, TypeScript, TailwindCSS, Vite, Nginx
- Backend: Python, FastAPI, Pydantic, SQLAlchemy async
- Database: PostgreSQL
- AI: LangChain, OpenAI GPT, heuristic fallback for demos
- Parsing: PyMuPDF, python-docx, TXT
- Payments: x402-style middleware using `X-PAYMENT`
- Deployment: Docker Compose with frontend, backend, and Postgres

## Technical Highlights

- Clean architecture with routers, services, repositories, schemas, and models
- Real JWT authentication and refresh token rotation
- File signature validation and upload size enforcement
- Structured JSON AI output
- Deterministic fallback when OpenAI credentials are unavailable
- x402 protection for `/analyze`, `/generate-summary`, `/rewrite-clause`, and `/download-report`
- Production-ready reverse proxy through Nginx

## Judging Points

- End-to-end functionality works locally in one command.
- The app solves a concrete business problem.
- AI output is structured and actionable.
- Payment protection is integrated at middleware level.
- The UX is polished enough for a live demo.

## Closing Line

Contract Guardian AI turns dense legal documents into clear risk decisions before the signature page becomes a problem.
