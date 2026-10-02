import pytest

from app.services.ai_analysis import AIAnalysisService


@pytest.mark.asyncio
async def test_heuristic_analysis_detects_unlimited_liability():
    text = """
Liability
The customer shall have unlimited liability and shall be liable for all indirect and consequential damages.

Renewal
This agreement shall automatically renew for successive one year terms.
"""
    result = await AIAnalysisService().analyze_contract(text)
    flags = {flag for clause in result.clauses for flag in clause.flags}
    assert "UNLIMITED_LIABILITY" in flags
    assert result.contract_risk_score >= 50


@pytest.mark.asyncio
async def test_rewrite_clause_returns_safer_alternative():
    result = await AIAnalysisService().rewrite_clause("Customer is liable for all damages.", None)
    assert result.safer_alternative
    assert result.original_clause.startswith("Customer")
