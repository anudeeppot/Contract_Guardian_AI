-- =============================================================
-- CONTRACT GUARDIAN AI - Index Design
-- CO1: Index Design (B-Tree, GIN, HNSW for vector)
-- =============================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

-- Contracts indexes
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts (user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_file_type ON contracts (file_type);
CREATE INDEX IF NOT EXISTS idx_contracts_risk ON contracts (user_id, created_at DESC);

-- Full-text search index on contract extracted_text
CREATE INDEX IF NOT EXISTS idx_contracts_text_search
    ON contracts USING gin(to_tsvector('english', COALESCE(extracted_text, '')));

-- Full-text search on title
CREATE INDEX IF NOT EXISTS idx_contracts_title_trgm
    ON contracts USING gin(title gin_trgm_ops);

-- Analyses indexes
CREATE INDEX IF NOT EXISTS idx_analyses_contract_id ON analyses (contract_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses (user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_risk_level ON analyses (risk_level);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses (created_at DESC);

-- Clause analyses indexes
CREATE INDEX IF NOT EXISTS idx_clause_analyses_analysis_id ON clause_analyses (analysis_id);
CREATE INDEX IF NOT EXISTS idx_clause_analyses_risk ON clause_analyses (risk);
CREATE INDEX IF NOT EXISTS idx_clause_analyses_position ON clause_analyses (analysis_id, position);

-- Refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- Activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs (activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs (entity_type, entity_id);

-- Contract embeddings - HNSW index for ANN search (pgvector CO2)
CREATE INDEX IF NOT EXISTS idx_contract_embeddings_hnsw
    ON contract_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_contract_embeddings_contract_id
    ON contract_embeddings (contract_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments (payment_id);

-- Reports
CREATE INDEX IF NOT EXISTS idx_reports_contract_id ON reports (contract_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports (user_id);

-- Risk findings
CREATE INDEX IF NOT EXISTS idx_risk_findings_analysis_id ON risk_findings (analysis_id);
CREATE INDEX IF NOT EXISTS idx_risk_findings_severity ON risk_findings (severity);
