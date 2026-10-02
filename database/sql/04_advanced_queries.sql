-- =============================================================
-- CONTRACT GUARDIAN AI - Advanced SQL Queries
-- CO1: DML, JOINs, Subqueries, CTEs, Window Functions, etc.
-- =============================================================

-- =============================================================
-- 1. INNER JOIN: Contracts with their latest analysis
-- =============================================================
SELECT
    c.id              AS contract_id,
    c.original_filename,
    c.status,
    c.created_at      AS upload_date,
    a.contract_risk_score,
    a.risk_level,
    a.created_at      AS analysis_date
FROM contracts c
INNER JOIN analyses a ON a.contract_id = c.id
ORDER BY a.created_at DESC;

-- =============================================================
-- 2. LEFT JOIN: All contracts even without analysis
-- =============================================================
SELECT
    c.id,
    c.original_filename,
    c.status,
    COALESCE(a.contract_risk_score, -1) AS risk_score,
    COALESCE(a.risk_level::TEXT, 'NOT_ANALYZED') AS risk_level
FROM contracts c
LEFT JOIN analyses a ON a.contract_id = c.id
ORDER BY c.created_at DESC;

-- =============================================================
-- 3. MULTI-TABLE JOIN: Users, contracts, analyses, clauses
-- =============================================================
SELECT
    u.email,
    c.original_filename,
    a.contract_risk_score,
    COUNT(ca.id)               AS clause_count,
    AVG(ca.risk_score)         AS avg_clause_score,
    MAX(ca.risk_score)         AS max_clause_score
FROM users u
JOIN contracts c      ON c.user_id = u.id
JOIN analyses a       ON a.contract_id = c.id
JOIN clause_analyses ca ON ca.analysis_id = a.id
GROUP BY u.email, c.original_filename, a.contract_risk_score
ORDER BY a.contract_risk_score DESC;

-- =============================================================
-- 4. SUBQUERY: Contracts with above-average risk score
-- =============================================================
SELECT
    c.id,
    c.original_filename,
    a.contract_risk_score
FROM contracts c
JOIN analyses a ON a.contract_id = c.id
WHERE a.contract_risk_score > (
    SELECT AVG(contract_risk_score) FROM analyses
)
ORDER BY a.contract_risk_score DESC;

-- =============================================================
-- 5. CORRELATED SUBQUERY: Latest analysis per contract
-- =============================================================
SELECT
    c.id,
    c.original_filename,
    (
        SELECT a.contract_risk_score
        FROM analyses a
        WHERE a.contract_id = c.id
        ORDER BY a.created_at DESC
        LIMIT 1
    ) AS latest_risk_score
FROM contracts c
ORDER BY c.created_at DESC;

-- =============================================================
-- 6. CTE: Risk distribution across users
-- =============================================================
WITH user_risk_stats AS (
    SELECT
        u.id,
        u.email,
        COUNT(a.id)            AS analysis_count,
        AVG(a.contract_risk_score) AS avg_score,
        MAX(a.contract_risk_score) AS max_score
    FROM users u
    LEFT JOIN contracts c ON c.user_id = u.id
    LEFT JOIN analyses a  ON a.contract_id = c.id
    GROUP BY u.id, u.email
),
risk_bands AS (
    SELECT
        email,
        analysis_count,
        ROUND(avg_score, 2) AS avg_score,
        max_score,
        CASE
            WHEN avg_score >= 80 THEN 'HIGH_RISK_USER'
            WHEN avg_score >= 50 THEN 'MEDIUM_RISK_USER'
            WHEN avg_score >= 0  THEN 'LOW_RISK_USER'
            ELSE                      'NO_DATA'
        END AS user_risk_profile
    FROM user_risk_stats
)
SELECT * FROM risk_bands ORDER BY avg_score DESC NULLS LAST;

-- =============================================================
-- 7. RECURSIVE CTE: Clause dependency chain
-- (Demonstrates recursive CTE even if data is flat)
-- =============================================================
WITH RECURSIVE clause_hierarchy AS (
    -- Base case: root level clauses (position = 1)
    SELECT
        ca.id,
        ca.analysis_id,
        ca.title,
        ca.position,
        ca.risk_score,
        1 AS depth,
        ca.title AS path
    FROM clause_analyses ca
    WHERE ca.position = 1

    UNION ALL

    -- Recursive: next clauses
    SELECT
        ca.id,
        ca.analysis_id,
        ca.title,
        ca.position,
        ca.risk_score,
        ch.depth + 1,
        ch.path || ' -> ' || ca.title
    FROM clause_analyses ca
    JOIN clause_hierarchy ch
        ON ca.analysis_id = ch.analysis_id
        AND ca.position = ch.position + 1
    WHERE ch.depth < 20  -- prevent infinite recursion
)
SELECT * FROM clause_hierarchy ORDER BY analysis_id, position;

-- =============================================================
-- 8. WINDOW FUNCTIONS: Risk ranking
-- =============================================================
SELECT
    c.original_filename,
    a.contract_risk_score,
    a.risk_level,
    ROW_NUMBER()  OVER (ORDER BY a.contract_risk_score DESC) AS row_num,
    RANK()        OVER (ORDER BY a.contract_risk_score DESC) AS rank,
    DENSE_RANK()  OVER (ORDER BY a.contract_risk_score DESC) AS dense_rank,
    NTILE(4)      OVER (ORDER BY a.contract_risk_score DESC) AS quartile,
    LAG(a.contract_risk_score)  OVER (ORDER BY a.created_at) AS prev_score,
    LEAD(a.contract_risk_score) OVER (ORDER BY a.created_at) AS next_score,
    AVG(a.contract_risk_score)  OVER ()                       AS global_avg,
    SUM(a.contract_risk_score)  OVER (ORDER BY a.created_at ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
                                AS rolling_sum_3
FROM contracts c
JOIN analyses a ON a.contract_id = c.id
ORDER BY a.contract_risk_score DESC;

-- =============================================================
-- 9. GROUP BY + HAVING + AGGREGATE: High-risk clause patterns
-- =============================================================
SELECT
    ca.title                    AS clause_type,
    COUNT(*)                    AS occurrence_count,
    ROUND(AVG(ca.risk_score), 2) AS avg_risk_score,
    MAX(ca.risk_score)          AS max_risk_score,
    MIN(ca.risk_score)          AS min_risk_score,
    STDDEV(ca.risk_score)       AS stddev_score,
    STRING_AGG(DISTINCT ca.risk::TEXT, ', ') AS risk_levels
FROM clause_analyses ca
GROUP BY ca.title
HAVING AVG(ca.risk_score) > 30
ORDER BY avg_risk_score DESC;

-- =============================================================
-- 10. CASE Statement: Risk categorization
-- =============================================================
SELECT
    c.original_filename,
    a.contract_risk_score,
    CASE
        WHEN a.contract_risk_score >= 80 THEN 'Do NOT sign without legal review'
        WHEN a.contract_risk_score >= 60 THEN 'Negotiate key clauses first'
        WHEN a.contract_risk_score >= 40 THEN 'Review flagged clauses'
        WHEN a.contract_risk_score >= 20 THEN 'Standard review recommended'
        ELSE                                   'Generally safe to proceed'
    END AS recommendation,
    CASE a.risk_level
        WHEN 'CRITICAL' THEN '🔴'
        WHEN 'HIGH'     THEN '🟠'
        WHEN 'MEDIUM'   THEN '🟡'
        WHEN 'LOW'      THEN '🟢'
    END AS risk_icon
FROM contracts c
JOIN analyses a ON a.contract_id = c.id
ORDER BY a.contract_risk_score DESC;

-- =============================================================
-- 11. TRANSACTION with SAVEPOINT (ACID demonstration)
-- =============================================================
-- Demonstrates atomicity, consistency, isolation, durability
BEGIN;
    SAVEPOINT sp_before_analysis;

    -- Simulate creating an analysis
    -- INSERT INTO analyses (...) VALUES (...);

    -- If something fails, roll back to savepoint
    -- ROLLBACK TO SAVEPOINT sp_before_analysis;

    -- On success
    -- RELEASE SAVEPOINT sp_before_analysis;
COMMIT;

-- =============================================================
-- 12. SET TRANSACTION ISOLATION LEVEL (MVCC demo)
-- =============================================================
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- PostgreSQL default: reader sees committed data
-- MVCC: each statement sees snapshot at statement start
COMMIT;

BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- Reader sees snapshot at transaction start
-- Prevents non-repeatable reads
COMMIT;

BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- Strongest: prevents phantom reads
-- Full ACID compliance
COMMIT;

-- =============================================================
-- 13. DML Examples
-- =============================================================

-- INSERT with conflict resolution
INSERT INTO tags (name, color) VALUES
    ('High Risk', '#ef4444'),
    ('Employment', '#3b82f6'),
    ('NDA', '#8b5cf6'),
    ('SaaS', '#06b6d4'),
    ('Investment', '#f59e0b')
ON CONFLICT (name) DO NOTHING;

-- UPDATE with JOIN
UPDATE contracts
SET title = COALESCE(title, original_filename),
    updated_at = NOW()
WHERE title IS NULL;

-- DELETE with subquery
-- DELETE FROM refresh_tokens
-- WHERE user_id IN (SELECT id FROM users WHERE is_active = FALSE);
