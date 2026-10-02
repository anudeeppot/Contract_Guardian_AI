-- =============================================================
-- CONTRACT GUARDIAN AI - MySQL Schema (DDL)
-- Converted from PostgreSQL to MySQL 8.0+
-- Step 1: Run this file FIRST in MySQL Workbench
-- =============================================================

CREATE DATABASE IF NOT EXISTS contract_guardian
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE contract_guardian;

-- =============================================================
-- USERS TABLE (3NF)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id            CHAR(36)     NOT NULL DEFAULT (UUID()),
    email         VARCHAR(255) NOT NULL,
    password_hash TEXT         NOT NULL,
    full_name     VARCHAR(255) NULL,
    role          ENUM('USER','ADMIN','ANALYST') NOT NULL DEFAULT 'USER',
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_email CHECK (email LIKE '%@%')
) ENGINE=InnoDB COMMENT='User accounts - 3NF compliant';

-- =============================================================
-- CONTRACTS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS contracts (
    id                CHAR(36)      NOT NULL DEFAULT (UUID()),
    user_id           CHAR(36)      NOT NULL,
    original_filename VARCHAR(1000) NOT NULL,
    file_type         ENUM('PDF','DOCX','TXT') NOT NULL,
    storage_path      VARCHAR(1000) NOT NULL,
    file_size_bytes   BIGINT        NOT NULL,
    sha256            CHAR(64)      NOT NULL,
    status            ENUM('UPLOADED','PARSING','PARSED','ANALYZING','ANALYZED','ERROR') NOT NULL DEFAULT 'UPLOADED',
    extracted_text    LONGTEXT      NULL,
    page_count        INT           NULL,
    word_count        INT           NULL,
    parse_warnings    JSON          NOT NULL,
    title             VARCHAR(500)  NULL,
    contract_type     VARCHAR(100)  NULL,
    effective_date    DATE          NULL,
    expiry_date       DATE          NULL,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_contracts PRIMARY KEY (id),
    CONSTRAINT uq_contracts_storage UNIQUE (storage_path(500)),
    CONSTRAINT fk_contracts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_contracts_file_size CHECK (file_size_bytes > 0),
    CONSTRAINT chk_contracts_page_count CHECK (page_count IS NULL OR page_count > 0),
    CONSTRAINT chk_contracts_word_count CHECK (word_count IS NULL OR word_count >= 0),
    CONSTRAINT chk_contracts_dates CHECK (
        expiry_date IS NULL OR effective_date IS NULL OR expiry_date >= effective_date
    )
) ENGINE=InnoDB COMMENT='Contract documents';

-- =============================================================
-- CONTRACT VERSIONS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS contract_versions (
    id              CHAR(36)      NOT NULL DEFAULT (UUID()),
    contract_id     CHAR(36)      NOT NULL,
    version_number  INT           NOT NULL DEFAULT 1,
    storage_path    VARCHAR(1000) NOT NULL,
    file_size_bytes BIGINT        NOT NULL,
    sha256          CHAR(64)      NOT NULL,
    change_notes    TEXT          NULL,
    created_by      CHAR(36)      NOT NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_contract_versions PRIMARY KEY (id),
    CONSTRAINT uq_contract_version UNIQUE (contract_id, version_number),
    CONSTRAINT fk_cv_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    CONSTRAINT fk_cv_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_cv_file_size CHECK (file_size_bytes > 0)
) ENGINE=InnoDB;

-- =============================================================
-- ANALYSES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS analyses (
    id                   CHAR(36)     NOT NULL DEFAULT (UUID()),
    contract_id          CHAR(36)     NOT NULL,
    user_id              CHAR(36)     NOT NULL,
    contract_risk_score  INT          NOT NULL,
    risk_level           ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
    summary              JSON         NOT NULL,
    important_points     JSON         NOT NULL,
    fraud_warnings       JSON         NOT NULL,
    metadata             JSON         NOT NULL,
    model_used           VARCHAR(100) NULL,
    tokens_used          INT          NULL,
    analysis_duration_ms INT          NULL,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_analyses PRIMARY KEY (id),
    CONSTRAINT fk_analyses_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    CONSTRAINT fk_analyses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_analyses_risk_score CHECK (contract_risk_score BETWEEN 0 AND 100),
    CONSTRAINT chk_analyses_tokens CHECK (tokens_used IS NULL OR tokens_used >= 0),
    CONSTRAINT chk_analyses_duration CHECK (analysis_duration_ms IS NULL OR analysis_duration_ms >= 0)
) ENGINE=InnoDB;

-- =============================================================
-- CLAUSE ANALYSES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS clause_analyses (
    id                CHAR(36)     NOT NULL DEFAULT (UUID()),
    analysis_id       CHAR(36)     NOT NULL,
    title             VARCHAR(255) NOT NULL,
    clause_text       TEXT         NOT NULL,
    risk              ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
    risk_score        INT          NOT NULL,
    confidence        INT          NOT NULL,
    reason            TEXT         NOT NULL,
    legal_reasoning   TEXT         NOT NULL,
    business_impact   TEXT         NOT NULL,
    safer_alternative TEXT         NOT NULL,
    flags             JSON         NOT NULL,
    position          INT          NOT NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_clause_analyses PRIMARY KEY (id),
    CONSTRAINT fk_ca_analysis FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE,
    CONSTRAINT chk_ca_risk_score CHECK (risk_score BETWEEN 0 AND 100),
    CONSTRAINT chk_ca_confidence CHECK (confidence BETWEEN 0 AND 100),
    CONSTRAINT chk_ca_position CHECK (position > 0)
) ENGINE=InnoDB;

-- =============================================================
-- REFRESH TOKENS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         CHAR(36)  NOT NULL DEFAULT (UUID()),
    user_id    CHAR(36)  NOT NULL,
    token_hash CHAR(64)  NOT NULL,
    expires_at DATETIME  NOT NULL,
    revoked_at DATETIME  NULL,
    created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_rt_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB;

-- =============================================================
-- PAYMENTS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS payments (
    id          CHAR(36)       NOT NULL DEFAULT (UUID()),
    user_id     CHAR(36)       NULL,
    endpoint    TEXT           NOT NULL,
    method      VARCHAR(10)    NOT NULL,
    payment_id  VARCHAR(255)   NOT NULL,
    amount      DECIMAL(12,2)  NOT NULL,
    asset       VARCHAR(30)    NOT NULL,
    network     VARCHAR(50)    NOT NULL,
    receiver    VARCHAR(255)   NOT NULL,
    status      VARCHAR(30)    NOT NULL DEFAULT 'pending',
    raw_payload JSON           NOT NULL,
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_payments PRIMARY KEY (id),
    CONSTRAINT uq_payment_id UNIQUE (payment_id),
    CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_payments_amount CHECK (amount >= 0)
) ENGINE=InnoDB;

-- =============================================================
-- RISK FINDINGS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS risk_findings (
    id             CHAR(36)     NOT NULL DEFAULT (UUID()),
    analysis_id    CHAR(36)     NOT NULL,
    finding_type   VARCHAR(100) NOT NULL,
    severity       ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
    description    TEXT         NOT NULL,
    recommendation TEXT         NULL,
    location       TEXT         NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_risk_findings PRIMARY KEY (id),
    CONSTRAINT fk_rf_analysis FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================
-- REPORTS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS reports (
    id              CHAR(36)    NOT NULL DEFAULT (UUID()),
    contract_id     CHAR(36)    NOT NULL,
    analysis_id     CHAR(36)    NULL,
    user_id         CHAR(36)    NOT NULL,
    report_type     VARCHAR(50) NOT NULL DEFAULT 'PDF',
    storage_path    TEXT        NOT NULL,
    file_size_bytes BIGINT      NULL,
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_reports PRIMARY KEY (id),
    CONSTRAINT fk_reports_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    CONSTRAINT fk_reports_analysis FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE SET NULL,
    CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================
-- ACTIVITY LOGS TABLE (audit trail)
-- =============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    user_id       CHAR(36)    NULL,
    activity_type ENUM(
        'USER_LOGIN','USER_LOGOUT','USER_SIGNUP',
        'CONTRACT_UPLOAD','CONTRACT_DELETE','CONTRACT_VIEW',
        'ANALYSIS_START','ANALYSIS_COMPLETE',
        'REPORT_GENERATE','VECTOR_SEARCH','RAG_QUERY'
    ) NOT NULL,
    entity_type   VARCHAR(50) NULL,
    entity_id     CHAR(36)    NULL,
    description   TEXT        NOT NULL,
    ip_address    VARCHAR(45) NULL,
    user_agent    TEXT        NULL,
    metadata      JSON        NOT NULL,
    created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_activity_logs PRIMARY KEY (id),
    CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================
-- CONTRACT EMBEDDINGS TABLE
-- NOTE: MySQL has no native vector type.
-- Stored as JSON for DBMS demo. Use pgvector for production.
-- =============================================================
CREATE TABLE IF NOT EXISTS contract_embeddings (
    id           CHAR(36)  NOT NULL DEFAULT (UUID()),
    contract_id  CHAR(36)  NOT NULL,
    chunk_index  INT       NOT NULL,
    chunk_text   TEXT      NOT NULL,
    embedding    JSON      NULL COMMENT 'Vector as JSON array (1536-dim)',
    metadata     JSON      NOT NULL,
    created_at   DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_contract_embeddings PRIMARY KEY (id),
    CONSTRAINT uq_embedding_chunk UNIQUE (contract_id, chunk_index),
    CONSTRAINT fk_ce_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    CONSTRAINT chk_ce_chunk_index CHECK (chunk_index >= 0)
) ENGINE=InnoDB;

-- =============================================================
-- TAGS (many-to-many with contracts)
-- =============================================================
CREATE TABLE IF NOT EXISTS tags (
    id    CHAR(36)     NOT NULL DEFAULT (UUID()),
    name  VARCHAR(100) NOT NULL,
    color VARCHAR(20)  NOT NULL DEFAULT '#6366f1',
    CONSTRAINT pk_tags PRIMARY KEY (id),
    CONSTRAINT uq_tags_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contract_tags (
    contract_id CHAR(36)  NOT NULL,
    tag_id      CHAR(36)  NOT NULL,
    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_contract_tags PRIMARY KEY (contract_id, tag_id),
    CONSTRAINT fk_ct_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    CONSTRAINT fk_ct_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================
-- DATABASE CATALOG VIEW (metadata demonstration)
-- =============================================================
CREATE OR REPLACE VIEW v_database_catalog AS
SELECT
    t.TABLE_NAME    AS table_name,
    t.TABLE_TYPE    AS table_type,
    t.TABLE_COMMENT AS description,
    COUNT(c.COLUMN_NAME) AS column_count
FROM information_schema.TABLES t
LEFT JOIN information_schema.COLUMNS c
    ON c.TABLE_NAME   = t.TABLE_NAME
    AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
WHERE t.TABLE_SCHEMA = 'contract_guardian'
GROUP BY t.TABLE_NAME, t.TABLE_TYPE, t.TABLE_COMMENT
ORDER BY t.TABLE_NAME;
