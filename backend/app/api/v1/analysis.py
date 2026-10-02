from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import current_user
from app.db.models import Analysis, User
from app.db.session import get_db
from app.schemas.analysis import (
    AnalysisResult,
    AnalyzeRequest,
    ClauseResult,
    ContractSummary,
    GenerateSummaryRequest,
    ImportantPoint,
    RewriteClauseRequest,
    RewriteClauseResponse,
)
from app.services.analysis import AnalysisService

router = APIRouter(tags=["Analysis"])


def analysis_response(analysis: Analysis) -> AnalysisResult:
    return AnalysisResult(
        analysis_id=str(analysis.id),
        contract_id=str(analysis.contract_id),
        status="completed",
        contract_risk_score=analysis.contract_risk_score,
        risk_level=analysis.risk_level,
        summary=ContractSummary.model_validate(analysis.summary),
        important_points=[ImportantPoint.model_validate(item) for item in analysis.important_points],
        fraud_warnings=analysis.fraud_warnings,
        clauses=[
            ClauseResult(
                title=clause.title,
                text=clause.text,
                risk=clause.risk,
                risk_score=clause.risk_score,
                confidence=clause.confidence,
                reason=clause.reason,
                legal_reasoning=clause.legal_reasoning,
                business_impact=clause.business_impact,
                safer_alternative=clause.safer_alternative,
                flags=clause.flags,
            )
            for clause in sorted(analysis.clauses, key=lambda item: item.position)
        ],
    )


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(
    payload: AnalyzeRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis = await AnalysisService(db).analyze(UUID(payload.contract_id), user.id)
    return analysis_response(analysis)


@router.post("/generate-summary", response_model=ContractSummary)
async def generate_summary(
    payload: GenerateSummaryRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    return await AnalysisService(db).generate_summary(UUID(payload.contract_id), user.id)


@router.post("/rewrite-clause", response_model=RewriteClauseResponse)
async def rewrite_clause(
    payload: RewriteClauseRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    _ = user
    return await AnalysisService(db).rewrite_clause(payload.clause, payload.risk_context)


@router.get("/contracts/{contract_id}/analysis", response_model=AnalysisResult)
async def latest_analysis(
    contract_id: UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    return analysis_response(await AnalysisService(db).latest(contract_id, user.id))


@router.get("/analyses/{analysis_id}", response_model=AnalysisResult)
async def get_analysis(
    analysis_id: UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    return analysis_response(await AnalysisService(db).get(analysis_id, user.id))


@router.get("/history", response_model=list[AnalysisResult])
async def history(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    contracts = await AnalysisService(db).contract_service.list_owned(user.id)
    results = []
    service = AnalysisService(db)
    for contract in contracts:
        try:
            results.append(analysis_response(await service.latest(contract.id, user.id)))
        except Exception:
            continue
    return results
