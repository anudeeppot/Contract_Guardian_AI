"""
Advanced SQL analytics API endpoint (CO1).
Exposes advanced SQL queries: CTEs, window functions, aggregates, etc.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import current_user, require_role
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/analytics", tags=["Analytics (CO1 SQL)"])


@router.get("/dashboard")
async def get_dashboard_stats(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Dashboard stats using multi-table JOIN + aggregates.
    CO1: GROUP BY, COUNT, AVG, MAX, JOINs.
    """
    result = await db.execute(
        text("""
            SELECT
                COUNT(DISTINCT c.id)                               AS total_contracts,
                COUNT(DISTINCT a.id)                               AS total_analyses,
                COALESCE(ROUND(AVG(a.contract_risk_score), 2), 0)  AS avg_risk_score,
                COALESCE(MAX(a.contract_risk_score), 0)            AS max_risk_score,
                COUNT(DISTINCT c.id) FILTER (WHERE a.risk_level = 'CRITICAL') AS critical_count,
                COUNT(DISTINCT c.id) FILTER (WHERE a.risk_level = 'HIGH')     AS high_count,
                COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'ANALYZED' OR c.status = 'PARSED') AS analyzed_count
            FROM contracts c
            LEFT JOIN analyses a ON a.contract_id = c.id
            WHERE c.user_id = :user_id
        """),
        {"user_id": str(user.id)},
    )
    row = result.fetchone()
    return {
        "total_contracts": row.total_contracts or 0,
        "total_analyses": row.total_analyses or 0,
        "avg_risk_score": float(row.avg_risk_score or 0),
        "max_risk_score": row.max_risk_score or 0,
        "critical_count": row.critical_count or 0,
        "high_count": row.high_count or 0,
        "analyzed_count": row.analyzed_count or 0,
    }


@router.get("/risk-distribution")
async def get_risk_distribution(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Risk score distribution using GROUP BY + CASE.
    CO1: GROUP BY, HAVING, CASE expressions.
    """
    result = await db.execute(
        text("""
            SELECT
                a.risk_level,
                COUNT(*) AS count,
                ROUND(AVG(a.contract_risk_score), 2) AS avg_score,
                MIN(a.contract_risk_score) AS min_score,
                MAX(a.contract_risk_score) AS max_score
            FROM analyses a
            JOIN contracts c ON c.id = a.contract_id
            WHERE c.user_id = :user_id
            GROUP BY a.risk_level
            ORDER BY
                CASE a.risk_level
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                    ELSE 5
                END
        """),
        {"user_id": str(user.id)},
    )
    rows = result.fetchall()
    return [
        {
            "risk_level": r.risk_level,
            "count": r.count,
            "avg_score": float(r.avg_score or 0),
            "min_score": r.min_score,
            "max_score": r.max_score,
        }
        for r in rows
    ]


@router.get("/top-risky-clauses")
async def get_top_risky_clauses(
    limit: int = 10,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Top risky clauses using multi-table JOIN + aggregates + HAVING.
    CO1: Multi-table JOINs, GROUP BY, HAVING, ORDER BY.
    """
    result = await db.execute(
        text("""
            SELECT
                ca.title,
                ca.risk,
                COUNT(*) AS occurrences,
                ROUND(AVG(ca.risk_score), 2) AS avg_score,
                MAX(ca.risk_score) AS max_score
            FROM clause_analyses ca
            JOIN analyses a ON a.id = ca.analysis_id
            JOIN contracts c ON c.id = a.contract_id
            WHERE c.user_id = :user_id
            GROUP BY ca.title, ca.risk
            HAVING COUNT(*) >= 1
            ORDER BY avg_score DESC, occurrences DESC
            LIMIT :lim
        """),
        {"user_id": str(user.id), "lim": limit},
    )
    rows = result.fetchall()
    return [
        {
            "clause_title": r.title,
            "risk_level": r.risk,
            "occurrences": r.occurrences,
            "avg_score": float(r.avg_score or 0),
            "max_score": r.max_score,
        }
        for r in rows
    ]


@router.get("/window-functions")
async def get_window_function_demo(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Window function demo: RANK, DENSE_RANK, ROW_NUMBER, LAG, LEAD.
    CO1: Window functions demonstration.
    """
    result = await db.execute(
        text("""
            SELECT
                c.original_filename,
                a.contract_risk_score,
                a.risk_level,
                a.created_at,
                ROW_NUMBER()  OVER (ORDER BY a.contract_risk_score DESC) AS row_num,
                RANK()        OVER (ORDER BY a.contract_risk_score DESC) AS rank,
                DENSE_RANK()  OVER (ORDER BY a.contract_risk_score DESC) AS dense_rank,
                LAG(a.contract_risk_score, 1)  OVER (ORDER BY a.created_at) AS prev_score,
                LEAD(a.contract_risk_score, 1) OVER (ORDER BY a.created_at) AS next_score,
                ROUND(AVG(a.contract_risk_score) OVER (), 2) AS global_avg
            FROM contracts c
            JOIN analyses a ON a.contract_id = c.id
            WHERE c.user_id = :user_id
            ORDER BY a.contract_risk_score DESC
        """),
        {"user_id": str(user.id)},
    )
    rows = result.fetchall()
    return [
        {
            "filename": r.original_filename,
            "risk_score": r.contract_risk_score,
            "risk_level": r.risk_level,
            "analysis_date": r.created_at.isoformat() if r.created_at else None,
            "row_number": r.row_num,
            "rank": r.rank,
            "dense_rank": r.dense_rank,
            "prev_score": r.prev_score,
            "next_score": r.next_score,
            "global_avg": float(r.global_avg or 0),
        }
        for r in rows
    ]


@router.get("/cte-demo")
async def get_cte_demo(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    CTE demo: multi-step query with Common Table Expressions.
    CO1: CTEs (WITH clause).
    """
    result = await db.execute(
        text("""
            WITH contract_stats AS (
                SELECT
                    c.id AS contract_id,
                    c.original_filename,
                    COUNT(a.id)            AS analysis_count,
                    MAX(a.contract_risk_score) AS max_risk,
                    MIN(a.contract_risk_score) AS min_risk,
                    AVG(a.contract_risk_score) AS avg_risk
                FROM contracts c
                LEFT JOIN analyses a ON a.contract_id = c.id
                WHERE c.user_id = :user_id
                GROUP BY c.id, c.original_filename
            ),
            risk_categorized AS (
                SELECT
                    *,
                    CASE
                        WHEN avg_risk >= 80 THEN 'Do NOT Sign'
                        WHEN avg_risk >= 60 THEN 'Negotiate First'
                        WHEN avg_risk >= 40 THEN 'Review Clauses'
                        WHEN avg_risk IS NOT NULL THEN 'Generally Safe'
                        ELSE 'Not Analyzed'
                    END AS recommendation
                FROM contract_stats
            )
            SELECT * FROM risk_categorized
            ORDER BY avg_risk DESC NULLS LAST
        """),
        {"user_id": str(user.id)},
    )
    rows = result.fetchall()
    return [
        {
            "contract_id": str(r.contract_id),
            "filename": r.original_filename,
            "analysis_count": r.analysis_count,
            "max_risk": r.max_risk,
            "min_risk": r.min_risk,
            "avg_risk": float(r.avg_risk) if r.avg_risk else None,
            "recommendation": r.recommendation,
        }
        for r in rows
    ]


@router.get("/subquery-demo")
async def get_subquery_demo(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Correlated subquery: latest analysis per contract.
    CO1: Correlated subqueries.
    """
    result = await db.execute(
        text("""
            SELECT
                c.id,
                c.original_filename,
                c.status,
                c.created_at,
                (
                    SELECT a.contract_risk_score
                    FROM analyses a
                    WHERE a.contract_id = c.id
                    ORDER BY a.created_at DESC
                    LIMIT 1
                ) AS latest_risk_score,
                (
                    SELECT a.risk_level
                    FROM analyses a
                    WHERE a.contract_id = c.id
                    ORDER BY a.created_at DESC
                    LIMIT 1
                ) AS latest_risk_level
            FROM contracts c
            WHERE c.user_id = :user_id
            ORDER BY c.created_at DESC
        """),
        {"user_id": str(user.id)},
    )
    rows = result.fetchall()
    return [
        {
            "contract_id": str(r.id),
            "filename": r.original_filename,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "latest_risk_score": r.latest_risk_score,
            "latest_risk_level": r.latest_risk_level,
        }
        for r in rows
    ]


@router.get("/catalog")
async def get_db_catalog(
    user: User = Depends(require_role("ADMIN", "ANALYST")),
    db: AsyncSession = Depends(get_db),
):
    """
    Database catalog/metadata (CO1: DBMS catalog concept).
    Shows table names, column counts from information_schema.
    """
    result = await db.execute(
        text("""
            SELECT
                t.table_name,
                t.table_type,
                COUNT(c.column_name) AS column_count
            FROM information_schema.tables t
            LEFT JOIN information_schema.columns c
                ON c.table_name = t.table_name AND c.table_schema = t.table_schema
            WHERE t.table_schema = 'public'
            GROUP BY t.table_name, t.table_type
            ORDER BY t.table_name
        """)
    )
    rows = result.fetchall()
    return [
        {
            "table_name": r.table_name,
            "table_type": r.table_type,
            "column_count": r.column_count,
        }
        for r in rows
    ]


@router.get("/clause-flags-distribution")
async def get_clause_flags_distribution(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Clause flag frequency analysis using JSON array expansion.
    CO1: JSON aggregation, GROUP BY.
    """
    result = await db.execute(
        text("""
            SELECT
                ca.risk,
                COUNT(*) AS clause_count,
                ROUND(AVG(ca.risk_score), 2) AS avg_score,
                ROUND(AVG(ca.confidence), 2) AS avg_confidence
            FROM clause_analyses ca
            JOIN analyses a ON a.id = ca.analysis_id
            JOIN contracts c ON c.id = a.contract_id
            WHERE c.user_id = :user_id
            GROUP BY ca.risk
            ORDER BY avg_score DESC
        """),
        {"user_id": str(user.id)},
    )
    rows = result.fetchall()
    return [
        {
            "risk_level": r.risk,
            "clause_count": r.clause_count,
            "avg_score": float(r.avg_score or 0),
            "avg_confidence": float(r.avg_confidence or 0),
        }
        for r in rows
    ]
