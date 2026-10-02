from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ContractStatus
from app.core.errors import bad_request, not_found
from app.db.models import Analysis, ClauseAnalysis
from app.repositories.contracts import AnalysisRepository
from app.services.ai_analysis import AIAnalysisService
from app.services.contracts import ContractService


class AnalysisService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.contract_service = ContractService(db)
        self.analyses = AnalysisRepository(db)
        self.ai = AIAnalysisService()

    async def analyze(self, contract_id: UUID, user_id: UUID) -> Analysis:
        contract = await self.contract_service.get_owned(contract_id, user_id)
        if not contract.extracted_text:
            contract = await self.contract_service.extract_text(contract)
        if not contract.extracted_text:
            raise bad_request("DOCUMENT_PARSE_FAILED", "No text could be extracted from the document")
        contract.status = ContractStatus.ANALYZING.value
        await self.db.flush()
        result = await self.ai.analyze_contract(contract.extracted_text)
        analysis = Analysis(
            contract_id=contract.id,
            user_id=user_id,
            contract_risk_score=result.contract_risk_score,
            risk_level=result.risk_level,
            summary=result.summary.model_dump(),
            important_points=[point.model_dump() for point in result.important_points],
            fraud_warnings=[warning.model_dump() for warning in result.fraud_warnings],
            analysis_metadata={"engine": "openai" if self.ai._build_llm() else "heuristic-fallback"},
        )
        clauses = [
            ClauseAnalysis(
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
                position=index,
            )
            for index, clause in enumerate(result.clauses, start=1)
        ]
        saved = await self.analyses.create(analysis, clauses)
        contract.status = ContractStatus.COMPLETED.value
        await self.db.commit()
        return await self.analyses.get_owned(saved.id, user_id) or saved

    async def latest(self, contract_id: UUID, user_id: UUID) -> Analysis:
        analysis = await self.analyses.latest_for_contract(contract_id, user_id)
        if not analysis:
            raise not_found("Analysis")
        return analysis

    async def get(self, analysis_id: UUID, user_id: UUID) -> Analysis:
        analysis = await self.analyses.get_owned(analysis_id, user_id)
        if not analysis:
            raise not_found("Analysis")
        return analysis

    async def generate_summary(self, contract_id: UUID, user_id: UUID) -> dict:
        contract = await self.contract_service.get_owned(contract_id, user_id)
        if not contract.extracted_text:
            contract = await self.contract_service.extract_text(contract)
        summary = await self.ai.generate_summary(contract.extracted_text or "")
        return summary.model_dump()

    async def rewrite_clause(self, clause: str, risk_context: str | None) -> dict:
        rewrite = await self.ai.rewrite_clause(clause, risk_context)
        return rewrite.model_dump()
