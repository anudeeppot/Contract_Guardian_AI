-- =============================================================
-- CONTRACT GUARDIAN AI - Views, Functions, Triggers & Stored Procedures
-- CO1: Views, PL/pgSQL Functions, Triggers, Stored Logic
-- =============================================================

-- =============================================================
-- VIEWS
-- =============================================================

-- 1. Contract Dashboard View (JOIN, aggregates)
CREATE OR REPLACE VIEW v_contract_dashboard AS
SELECT
    u.id              AS user_id,
    u.email           AS user_email,
    u.full_name,
    COUNT(DISTINCT c.id)                    AS total_contracts,
    COUNT(DISTINCT a.id)                    AS total_analyses,
    ROUND(AVG(a.contract_risk_score), 2)   AS avg_risk_score,
    MAX(a.contract_risk_score)              AS max_risk_score,
    COUNT(DISTINCT c.id) FILTER (WHERE a.risk_level = 'CRITICAL') AS critical_contracts,
    COUNT(DISTINCT c.id) FILTER (WHERE a.risk_level = 'HIGH')     AS high_risk_contracts,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'ANALYZED')     AS analyzed_contracts,
    MAX(c.created_at)                       AS last_upload
FROM users u
LEFT JOIN contracts c ON c.user_id = u.id
LEFT JOIN analyses  a ON a.contract_id = c.id
GROUP BY u.id, u.email, u.full_name;

COMMENT ON VIEW v_contract_dashboard IS 'Aggregated dashboard metrics per user';

-- 2. Risk Summary View (window functions)
CREATE OR REPLACE VIEW v_risk_summary AS
SELECT
    c.id               AS contract_id,
    c.original_filename,
    c.user_id,
    a.id               AS analysis_id,
    a.contract_risk_score,
    a.risk_level,
    a.created_at       AS analysis_date,
    RANK() OVER (PARTITION BY c.user_id ORDER BY a.contract_risk_score DESC)
                       AS risk_rank,
    DENSE_RANK() OVER (PARTITION BY c.user_id ORDER BY a.contract_risk_score DESC)
                       AS dense_risk_rank,
    ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY a.created_at DESC)
                       AS recency_rank
FROM contracts c
JOIN analyses a ON a.contract_id = c.id;

COMMENT ON VIEW v_risk_summary IS 'Risk rankings with window functions';

-- 3. Clause Risk Heatmap View
CREATE OR REPLACE VIEW v_clause_risk_heatmap AS
SELECT
    ca.analysis_id,
    ca.title          AS clause_title,
    ca.risk           AS risk_level,
    ca.risk_score,
    ca.confidence,
    ca.flags,
    CASE
        WHEN ca.risk_score >= 80 THEN 'CRITICAL'
        WHEN ca.risk_score >= 60 THEN 'HIGH'
        WHEN ca.risk_score >= 30 THEN 'MEDIUM'
        ELSE                          'LOW'
    END               AS computed_risk_band,
    ca.position
FROM clause_analyses ca
ORDER BY ca.risk_score DESC;

-- 4. Activity Audit View
CREATE OR REPLACE VIEW v_activity_audit AS
SELECT
    al.id,
    al.created_at,
    u.email           AS user_email,
    al.activity_type,
    al.entity_type,
    al.entity_id,
    al.description,
    al.ip_address,
    al.metadata
FROM activity_logs al
LEFT JOIN users u ON u.id = al.user_id
ORDER BY al.created_at DESC;

-- 5. Analytics Overview View (CTE inside view)
CREATE OR REPLACE VIEW v_analytics_overview AS
WITH monthly_stats AS (
    SELECT
        DATE_TRUNC('month', c.created_at)  AS month,
        COUNT(*)                           AS uploads,
        COUNT(DISTINCT c.user_id)          AS active_users
    FROM contracts c
    GROUP BY 1
),
risk_distribution AS (
    SELECT
        risk_level,
        COUNT(*)                           AS count,
        ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS pct
    FROM analyses
    GROUP BY risk_level
)
SELECT
    ms.month,
    ms.uploads,
    ms.active_users,
    rd.risk_level,
    rd.count AS risk_count,
    rd.pct   AS risk_pct
FROM monthly_stats ms
CROSS JOIN risk_distribution rd
ORDER BY ms.month DESC;

-- =============================================================
-- TRIGGERS
-- =============================================================

-- Auto-update updated_at on users
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON contracts;
CREATE TRIGGER trg_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Auto-log user activity on contract insert
CREATE OR REPLACE FUNCTION fn_log_contract_upload()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO activity_logs (user_id, activity_type, entity_type, entity_id, description)
    VALUES (
        NEW.user_id,
        'CONTRACT_UPLOAD',
        'contract',
        NEW.id,
        'Contract uploaded: ' || NEW.original_filename
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_contract_upload ON contracts;
CREATE TRIGGER trg_log_contract_upload
    AFTER INSERT ON contracts
    FOR EACH ROW EXECUTE FUNCTION fn_log_contract_upload();

-- Auto-log analysis completion
CREATE OR REPLACE FUNCTION fn_log_analysis_complete()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO activity_logs (user_id, activity_type, entity_type, entity_id, description, metadata)
    VALUES (
        NEW.user_id,
        'ANALYSIS_COMPLETE',
        'analysis',
        NEW.id,
        'Analysis completed. Risk score: ' || NEW.contract_risk_score || ' (' || NEW.risk_level || ')',
        jsonb_build_object('risk_score', NEW.contract_risk_score, 'risk_level', NEW.risk_level)
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_analysis_complete ON analyses;
CREATE TRIGGER trg_log_analysis_complete
    AFTER INSERT ON analyses
    FOR EACH ROW EXECUTE FUNCTION fn_log_analysis_complete();

-- =============================================================
-- STORED FUNCTIONS / PROCEDURES
-- =============================================================

-- Function: get risk statistics for a user
CREATE OR REPLACE FUNCTION fn_user_risk_stats(p_user_id UUID)
RETURNS TABLE (
    total_contracts    BIGINT,
    total_analyses     BIGINT,
    avg_risk_score     NUMERIC,
    critical_count     BIGINT,
    high_count         BIGINT,
    medium_count       BIGINT,
    low_count          BIGINT
) LANGUAGE plpgsql AS
$$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT c.id)                                               AS total_contracts,
        COUNT(DISTINCT a.id)                                               AS total_analyses,
        ROUND(AVG(a.contract_risk_score), 2)                              AS avg_risk_score,
        COUNT(DISTINCT a.id) FILTER (WHERE a.risk_level = 'CRITICAL')     AS critical_count,
        COUNT(DISTINCT a.id) FILTER (WHERE a.risk_level = 'HIGH')         AS high_count,
        COUNT(DISTINCT a.id) FILTER (WHERE a.risk_level = 'MEDIUM')       AS medium_count,
        COUNT(DISTINCT a.id) FILTER (WHERE a.risk_level = 'LOW')          AS low_count
    FROM contracts c
    LEFT JOIN analyses a ON a.contract_id = c.id AND a.user_id = p_user_id
    WHERE c.user_id = p_user_id;
END;
$$;

-- Function: get top risky clauses system-wide
CREATE OR REPLACE FUNCTION fn_top_risky_clauses(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    clause_title  VARCHAR,
    risk_level    risk_level,
    avg_score     NUMERIC,
    occurrences   BIGINT
) LANGUAGE plpgsql AS
$$
BEGIN
    RETURN QUERY
    SELECT
        ca.title              AS clause_title,
        ca.risk               AS risk_level,
        ROUND(AVG(ca.risk_score), 2) AS avg_score,
        COUNT(*)              AS occurrences
    FROM clause_analyses ca
    GROUP BY ca.title, ca.risk
    ORDER BY avg_score DESC, occurrences DESC
    LIMIT p_limit;
END;
$$;

-- Procedure: cleanup expired refresh tokens (demonstrates ACID)
CREATE OR REPLACE PROCEDURE proc_cleanup_expired_tokens()
LANGUAGE plpgsql AS
$$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW()
       OR revoked_at IS NOT NULL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Cleaned up % expired/revoked tokens', deleted_count;
    COMMIT;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Token cleanup failed: %', SQLERRM;
    ROLLBACK;
END;
$$;

-- Function: search contracts with full-text search
CREATE OR REPLACE FUNCTION fn_search_contracts(
    p_user_id UUID,
    p_query   TEXT,
    p_limit   INTEGER DEFAULT 20
)
RETURNS TABLE (
    contract_id UUID,
    filename    TEXT,
    status      contract_status,
    rank        REAL,
    created_at  TIMESTAMPTZ
) LANGUAGE plpgsql AS
$$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.original_filename,
        c.status,
        ts_rank(
            to_tsvector('english', COALESCE(c.extracted_text, '')),
            plainto_tsquery('english', p_query)
        ) AS rank,
        c.created_at
    FROM contracts c
    WHERE c.user_id = p_user_id
      AND to_tsvector('english', COALESCE(c.extracted_text, ''))
          @@ plainto_tsquery('english', p_query)
    ORDER BY rank DESC, c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =============================================================
-- TRANSACTION ISOLATION DEMO (documented with examples)
-- =============================================================

-- This function demonstrates transaction isolation levels
CREATE OR REPLACE FUNCTION fn_isolation_demo()
RETURNS TEXT LANGUAGE plpgsql AS
$$
BEGIN
    RETURN 'Isolation levels: READ_COMMITTED (default in PostgreSQL), ' ||
           'REPEATABLE_READ, SERIALIZABLE. ' ||
           'PostgreSQL uses MVCC (Multi-Version Concurrency Control) - ' ||
           'readers never block writers, writers never block readers. ' ||
           'Each transaction sees a snapshot of data as of transaction start.';
END;
$$;
