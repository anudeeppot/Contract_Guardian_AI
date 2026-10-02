-- =============================================================
-- CONTRACT GUARDIAN AI - PostgreSQL Schema (DDL)
-- CO1: Schema Design, Normalization, Constraints, Indexes
-- =============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
-- ENUM TYPES
-- =============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'ANALYST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM (
    'UPLOADED', 'PARSING', 'PARSED', 'ANALYZING', 'ANALYZED', 'ERROR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE file_type AS ENUM ('PDF', 'DOCX', 'TXT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM (
    'USER_LOGIN', 'USER_LOGOUT', 'USER_SIGNUP',
    'CONTRACT_UPLOAD', 'CONTRACT_DELETE', 'CONTRACT_VIEW',
    'ANALYSIS_START', 'ANALYSIS_COMPLETE',
    'REPORT_GENERATE', 'VECTOR_SEARCH', 'RAG_QUERY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- USERS TABLE (3NF: every non-key attr depends on whole PK only)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash TEXT          NOT NULL,
    full_name     VARCHAR(255),
    role          user_role     NOT NULL DEFAULT 'USER',
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_email CHECK (email LIKE '%@%')
);

COMMENT ON TABLE users IS 'User accounts - 3NF compliant';
COMMENT ON COLUMN users.role IS 'RBAC role: USER, ANALYST, or ADMIN';

-- =============================================================
-- CONTRACTS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS contracts (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename TEXT            NOT NULL,
    file_type         file_type       NOT NULL,
    storage_path      TEXT            NOT NULL UNIQUE,
    file_size_bytes   BIGINT          NOT NULL CHECK (file_size_bytes > 0),
    sha256            CHAR(64)        NOT NULL,
    status            contract_status NOT NULL DEFAULT 'UPLOADED',
    extracted_text    TEXT,
    page_count        INTEGER         CHECK (page_count IS NULL OR page_count > 0),
    word_count        INTEGER         CHECK (word_count IS NULL OR word_count >= 0),
    parse_warnings    JSONB           NOT NULL DEFAULT '[]',
    title             VARCHAR(500),
    contract_type     VARCHAR(100),
    effective_date    DATE,
    expiry_date       DATE,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_contracts_dates CHECK (
        expiry_date IS NULL OR effective_date IS NULL OR expiry_date >= effective_date
    )
);

COMMENT ON TABLE contracts IS 'Contract documents - FK enforces referential integrity to users';

-- =============================================================
-- CONTRACT VERSIONS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS contract_versions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    version_number  INTEGER     NOT NULL DEFAULT 1,
    storage_path    TEXT        NOT NULL,
    file_size_bytes BIGINT      NOT NULL CHECK (file_size_bytes > 0),
    sha256          CHAR(64)    NOT NULL,
    change_notes    TEXT,
    created_by      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (contract_id, version_number)
);

-- =============================================================
-- ANALYSES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS analyses (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id          UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contract_risk_score  INTEGER     NOT NULL CHECK (contract_risk_score BETWEEN 0 AND 100),
    risk_level           risk_level  NOT NULL,
    summary              JSONB       NOT NULL DEFAULT '{}',
    important_points     JSONB       NOT NULL DEFAULT '[]',
    fraud_warnings       JSONB       NOT NULL DEFAULT '[]',
    metadata             JSONB       NOT NULL DEFAULT '{}',
    model_used           VARCHAR(100),
    tokens_used          INTEGER     CHECK (tokens_used IS NULL OR tokens_used >= 0),
    analysis_duration_ms INTEGER     CHECK (analysis_duration_ms IS NULL OR analysis_duration_ms >= 0),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CLAUSE ANALYSES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS clause_analyses (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id       UUID        NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    title             VARCHAR(255) NOT NULL,
    text              TEXT        NOT NULL,
    risk              risk_level  NOT NULL,
    risk_score        INTEGER     NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    confidence        INTEGER     NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    reason            TEXT        NOT NULL DEFAULT '',
    legal_reasoning   TEXT        NOT NULL DEFAULT '',
    business_impact   TEXT        NOT NULL DEFAULT '',
    safer_alternative TEXT        NOT NULL DEFAULT '',
    flags             JSONB       NOT NULL DEFAULT '[]',
    position          INTEGER     NOT NULL CHECK (position > 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- REFRESH TOKENS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64)    NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_refresh_token_expiry CHECK (expires_at > created_at)
);

-- =============================================================
-- PAYMENTS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS payments (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID          REFERENCES users(id) ON DELETE CASCADE,
    endpoint    TEXT          NOT NULL,
    method      VARCHAR(10)   NOT NULL,
    payment_id  VARCHAR(255)  NOT NULL UNIQUE,
    amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    asset       VARCHAR(30)   NOT NULL,
    network     VARCHAR(50)   NOT NULL,
    receiver    VARCHAR(255)  NOT NULL,
    status      VARCHAR(30)   NOT NULL DEFAULT 'pending',
    raw_payload JSONB         NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================
-- RISK FINDINGS TABLE (3NF: normalized from analyses)
-- =============================================================
CREATE TABLE IF NOT EXISTS risk_findings (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id    UUID        NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    finding_type   VARCHAR(100) NOT NULL,
    severity       risk_level  NOT NULL,
    description    TEXT        NOT NULL,
    recommendation TEXT,
    location       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- REPORTS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS reports (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    analysis_id     UUID        REFERENCES analyses(id) ON DELETE SET NULL,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type     VARCHAR(50) NOT NULL DEFAULT 'PDF',
    storage_path    TEXT        NOT NULL,
    file_size_bytes BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ACTIVITY LOGS TABLE (audit trail)
-- =============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id            BIGSERIAL     PRIMARY KEY,
    user_id       UUID          REFERENCES users(id) ON DELETE SET NULL,
    activity_type activity_type NOT NULL,
    entity_type   VARCHAR(50),
    entity_id     UUID,
    description   TEXT          NOT NULL DEFAULT '',
    ip_address    INET,
    user_agent    TEXT,
    metadata      JSONB         NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CONTRACT EMBEDDINGS TABLE (pgvector - CO2)
-- =============================================================
CREATE TABLE IF NOT EXISTS contract_embeddings (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id  UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    chunk_index  INTEGER     NOT NULL CHECK (chunk_index >= 0),
    chunk_text   TEXT        NOT NULL,
    embedding    vector(1536),
    metadata     JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (contract_id, chunk_index)
);

-- =============================================================
-- TAGS (many-to-many with contracts)
-- =============================================================
CREATE TABLE IF NOT EXISTS tags (
    id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name  VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(20)  NOT NULL DEFAULT '#6366f1'
);

CREATE TABLE IF NOT EXISTS contract_tags (
    contract_id UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    tag_id      UUID        NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (contract_id, tag_id)
);

-- =============================================================
-- CATALOG VIEW (DBMS catalog/metadata demonstration)
-- =============================================================
CREATE OR REPLACE VIEW v_database_catalog AS
SELECT
    t.table_name,
    t.table_type,
    (SELECT COUNT(*) FROM information_schema.columns c
     WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS column_count,
    obj_description(
        (quote_ident(t.table_name))::regclass, 'pg_class'
    ) AS description
FROM information_schema.tables t
WHERE t.table_schema = 'public'
ORDER BY t.table_name;

COMMENT ON VIEW v_database_catalog IS 'DBMS metadata catalog view';
