-- =============================================================
-- CONTRACT GUARDIAN AI - MySQL Views, Triggers & Stored Procedures
-- Converted from PostgreSQL PL/pgSQL to MySQL
-- Step 3: Run AFTER 02_indexes_mysql.sql
-- =============================================================

USE contract_guardian;

-- Tell MySQL we are changing delimiter for multi-statement blocks
DELIMITER \$\$

-- =============================================================
-- VIEWS
-- =============================================================

-- 1. Contract Dashboard View (JOINs + aggregates)
CREATE OR REPLACE VIEW v_contract_dashboard AS
SELECT
    u.id                                                  AS user_id,
    u.email                                               AS user_email,
    u.full_name,
    COUNT(DISTINCT c.id)                                  AS total_contracts,
    COUNT(DISTINCT a.id)                                  AS total_analyses,
    ROUND(AVG(a.contract_risk_score), 2)                  AS avg_risk_score,
    MAX(a.contract_risk_score)                            AS max_risk_score,
    SUM(CASE WHEN a.risk_level = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_contracts,
    SUM(CASE WHEN a.risk_level = 'HIGH'     THEN 1 ELSE 0 END) AS high_risk_contracts,
    SUM(CASE WHEN c.status = 'ANALYZED'    THEN 1 ELSE 0 END)  AS analyzed_contracts,
    MAX(c.created_at)                                     AS last_upload
FROM users u
LEFT JOIN contracts c ON c.user_id = u.id
LEFT JOIN analyses  a ON a.contract_id = c.id
GROUP BY u.id, u.email, u.full_name\$\$

-- 2. Risk Summary View (window functions -- MySQL 8.0+ supports these)
CREATE OR REPLACE VIEW v_risk_summary AS
SELECT
    c.id                AS contract_id,
    c.original_filename,
    c.user_id,
    a.id                AS analysis_id,
    a.contract_risk_score,
    a.risk_level,
    a.created_at        AS analysis_date,
    RANK()       OVER (PARTITION BY c.user_id ORDER BY a.contract_risk_score DESC) AS risk_rank,
    DENSE_RANK() OVER (PARTITION BY c.user_id ORDER BY a.contract_risk_score DESC) AS dense_risk_rank,
    ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY a.created_at DESC)          AS recency_rank
FROM contracts c
JOIN analyses a ON a.contract_id = c.id\$\$

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
ORDER BY ca.risk_score DESC\$\$

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
ORDER BY al.created_at DESC\$\$

-- 5. Analytics Overview View (using subqueries instead of CTEs in VIEW)
CREATE OR REPLACE VIEW v_analytics_overview AS
SELECT
    ms.month,
    ms.uploads,
    ms.active_users,
    rd.risk_level,
    rd.risk_count,
    rd.risk_pct
FROM (
    SELECT
        DATE_FORMAT(c.created_at, '%Y-%m-01') AS month,
        COUNT(*)                               AS uploads,
        COUNT(DISTINCT c.user_id)             AS active_users
    FROM contracts c
    GROUP BY DATE_FORMAT(c.created_at, '%Y-%m-01')
) ms
CROSS JOIN (
    SELECT
        risk_level,
        COUNT(*)                                                                        AS risk_count,
        ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)                 AS risk_pct
    FROM analyses
    GROUP BY risk_level
) rd
ORDER BY ms.month DESC\$\$

-- =============================================================
-- TRIGGERS
-- =============================================================

-- Auto-update updated_at on contracts (users table handles it with ON UPDATE)
DROP TRIGGER IF EXISTS trg_log_contract_upload\$\$
CREATE TRIGGER trg_log_contract_upload
    AFTER INSERT ON contracts
    FOR EACH ROW
BEGIN
    INSERT INTO activity_logs (user_id, activity_type, entity_type, entity_id, description, metadata)
    VALUES (
        NEW.user_id,
        'CONTRACT_UPLOAD',
        'contract',
        NEW.id,
        CONCAT('Contract uploaded: ', NEW.original_filename),
        '{}'
    );
END\$\$

-- Auto-log analysis completion
DROP TRIGGER IF EXISTS trg_log_analysis_complete\$\$
CREATE TRIGGER trg_log_analysis_complete
    AFTER INSERT ON analyses
    FOR EACH ROW
BEGIN
    INSERT INTO activity_logs (user_id, activity_type, entity_type, entity_id, description, metadata)
    VALUES (
        NEW.user_id,
        'ANALYSIS_COMPLETE',
        'analysis',
        NEW.id,
        CONCAT('Analysis completed. Risk score: ', NEW.contract_risk_score, ' (', NEW.risk_level, ')'),
        JSON_OBJECT('risk_score', NEW.contract_risk_score, 'risk_level', NEW.risk_level)
    );
END\$\$

-- =============================================================
-- STORED PROCEDURES
-- =============================================================

-- Procedure: get risk statistics for a user
DROP PROCEDURE IF EXISTS proc_user_risk_stats\$\$
CREATE PROCEDURE proc_user_risk_stats(IN p_user_id CHAR(36))
BEGIN
    SELECT
        COUNT(DISTINCT c.id)                                                 AS total_contracts,
        COUNT(DISTINCT a.id)                                                 AS total_analyses,
        ROUND(AVG(a.contract_risk_score), 2)                                AS avg_risk_score,
        SUM(CASE WHEN a.risk_level = 'CRITICAL' THEN 1 ELSE 0 END)          AS critical_count,
        SUM(CASE WHEN a.risk_level = 'HIGH'     THEN 1 ELSE 0 END)          AS high_count,
        SUM(CASE WHEN a.risk_level = 'MEDIUM'   THEN 1 ELSE 0 END)          AS medium_count,
        SUM(CASE WHEN a.risk_level = 'LOW'      THEN 1 ELSE 0 END)          AS low_count
    FROM contracts c
    LEFT JOIN analyses a ON a.contract_id = c.id AND a.user_id = p_user_id
    WHERE c.user_id = p_user_id;
END\$\$

-- Procedure: get top risky clauses system-wide
DROP PROCEDURE IF EXISTS proc_top_risky_clauses\$\$
CREATE PROCEDURE proc_top_risky_clauses(IN p_limit INT)
BEGIN
    SET p_limit = IFNULL(p_limit, 10);
    SELECT
        ca.title                     AS clause_title,
        ca.risk                      AS risk_level,
        ROUND(AVG(ca.risk_score), 2) AS avg_score,
        COUNT(*)                     AS occurrences
    FROM clause_analyses ca
    GROUP BY ca.title, ca.risk
    ORDER BY avg_score DESC, occurrences DESC
    LIMIT p_limit;
END\$\$

-- Procedure: cleanup expired refresh tokens (ACID demo)
DROP PROCEDURE IF EXISTS proc_cleanup_expired_tokens\$\$
CREATE PROCEDURE proc_cleanup_expired_tokens()
BEGIN
    DECLARE deleted_count INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        DELETE FROM refresh_tokens
        WHERE expires_at < NOW()
           OR revoked_at IS NOT NULL;
        SET deleted_count = ROW_COUNT();
        SELECT CONCAT('Cleaned up ', deleted_count, ' expired/revoked tokens') AS message;
    COMMIT;
END\$\$

-- Procedure: full-text search on contracts
DROP PROCEDURE IF EXISTS proc_search_contracts\$\$
CREATE PROCEDURE proc_search_contracts(
    IN p_user_id CHAR(36),
    IN p_query   VARCHAR(500),
    IN p_limit   INT
)
BEGIN
    SET p_limit = IFNULL(p_limit, 20);
    SELECT
        c.id                AS contract_id,
        c.original_filename AS filename,
        c.status,
        MATCH(c.extracted_text) AGAINST (p_query IN NATURAL LANGUAGE MODE) AS relevance_rank,
        c.created_at
    FROM contracts c
    WHERE c.user_id = p_user_id
      AND MATCH(c.extracted_text) AGAINST (p_query IN NATURAL LANGUAGE MODE)
    ORDER BY relevance_rank DESC, c.created_at DESC
    LIMIT p_limit;
END\$\$

-- Function: isolation demo description
DROP FUNCTION IF EXISTS fn_isolation_demo\$\$
CREATE FUNCTION fn_isolation_demo()
RETURNS TEXT
DETERMINISTIC
BEGIN
    RETURN CONCAT(
        'Isolation levels in MySQL InnoDB: ',
        'READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ (default), SERIALIZABLE. ',
        'InnoDB uses MVCC (Multi-Version Concurrency Control) - ',
        'readers do not block writers; writers do not block readers. ',
        'Each transaction sees a consistent snapshot of data.'
    );
END\$\$

DELIMITER ;
