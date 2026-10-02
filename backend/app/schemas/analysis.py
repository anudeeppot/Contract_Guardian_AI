from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class APIModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ClauseResult(APIModel):
    title: str
    text: str
    risk: str
    risk_score: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)
    reason: str
    legal_reasoning: str
    business_impact: str
    safer_alternative: str
    flags: list[str] = []


class ContractSummary(APIModel):
    executive_summary: str
    purpose: str | None = None
    parties_involved: list[str] = []
    duration: str | None = None
    financial_obligations: list[str] = []
    termination_conditions: list[str] = []
    renewal: str | None = None
    important_dates: list[str] = []
    deliverables: list[str] = []


class ImportantPoint(APIModel):
    category: str
    text: str
    importance: str


class FraudWarning(APIModel):
    type: str
    text: str
    why_suspicious: str
    severity: str
    confidence: int = Field(ge=0, le=100)


class AnalysisResult(APIModel):
    analysis_id: str | None = None
    contract_id: str | None = None
    status: str = "completed"
    contract_risk_score: int = Field(ge=0, le=100)
    risk_level: str
    summary: ContractSummary
    important_points: list[ImportantPoint]
    fraud_warnings: list[FraudWarning]
    clauses: list[ClauseResult]


class AnalyzeRequest(APIModel):
    contract_id: str


class GenerateSummaryRequest(APIModel):
    contract_id: str


class RewriteClauseRequest(APIModel):
    clause: str
    risk_context: str | None = None


class RewriteClauseResponse(APIModel):
    original_clause: str
    safer_alternative: str
    reasoning: str
