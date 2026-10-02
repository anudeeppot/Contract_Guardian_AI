-- =============================================================
-- CONTRACT GUARDIAN AI - MySQL Index Design
-- Converted from PostgreSQL to MySQL 8.0+
-- Step 2: Run AFTER 01_schema_mysql.sql
-- =============================================================

USE contract_guardian;

-- Users indexes
CREATE INDEX idx_users_email      ON users (email);
CREATE INDEX idx_users_role       ON users (role);
CREATE INDEX idx_users_created_at ON users (created_at DESC);

-- Contracts indexes
CREATE INDEX idx_contracts_user_id    ON contracts (user_id);
CREATE INDEX idx_contracts_status     ON contracts (status);
CREATE INDEX idx_contracts_created_at ON contracts (created_at DESC);
CREATE INDEX idx_contracts_file_type  ON contracts (file_type);
CREATE INDEX idx_contracts_risk       ON contracts (user_id, created_at DESC);

-- Full-text search on extracted_text and title
-- (MySQL uses FULLTEXT instead of GIN/tsvector)
ALTER TABLE contracts ADD FULLTEXT INDEX idx_contracts_text_search (extracted_text);
ALTER TABLE contracts ADD FULLTEXT INDEX idx_contracts_title_fts   (title);

-- Analyses indexes
CREATE INDEX idx_analyses_contract_id ON analyses (contract_id);
CREATE INDEX idx_analyses_user_id     ON analyses (user_id);
CREATE INDEX idx_analyses_risk_level  ON analyses (risk_level);
CREATE INDEX idx_analyses_created_at  ON analyses (created_at DESC);

-- Clause analyses indexes
CREATE INDEX idx_clause_analyses_analysis_id ON clause_analyses (analysis_id);
CREATE INDEX idx_clause_analyses_risk        ON clause_analyses (risk);
CREATE INDEX idx_clause_analyses_position    ON clause_analyses (analysis_id, position);

-- Refresh tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_hash    ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- Activity logs
CREATE INDEX idx_activity_logs_user_id    ON activity_logs (user_id);
CREATE INDEX idx_activity_logs_type       ON activity_logs (activity_type);
CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_entity     ON activity_logs (entity_type, entity_id);

-- Contract embeddings
-- NOTE: MySQL does not support HNSW vector index natively.
-- Index on contract_id for JOIN performance.
CREATE INDEX idx_contract_embeddings_contract_id ON contract_embeddings (contract_id);

-- Payments
CREATE INDEX idx_payments_user_id    ON payments (user_id);
CREATE INDEX idx_payments_payment_id ON payments (payment_id);

-- Reports
CREATE INDEX idx_reports_contract_id ON reports (contract_id);
CREATE INDEX idx_reports_user_id     ON reports (user_id);

-- Risk findings
CREATE INDEX idx_risk_findings_analysis_id ON risk_findings (analysis_id);
CREATE INDEX idx_risk_findings_severity    ON risk_findings (severity);
