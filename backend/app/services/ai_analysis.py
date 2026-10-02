import json
import re

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from pydantic import ValidationError

from app.core.config import settings
from app.core.constants import RISK_FLAGS, risk_level_from_score
from app.schemas.analysis import (
    AnalysisResult,
    ClauseResult,
    ContractSummary,
    FraudWarning,
    ImportantPoint,
    RewriteClauseResponse,
)
from app.services.clause_detection import ClauseDetectionService


class AIAnalysisService:
    def __init__(self):
        self.clause_detector = ClauseDetectionService()

    async def analyze_contract(self, text: str) -> AnalysisResult:
        clauses = self.clause_detector.split_clauses(text)
        llm_result = await self._try_llm_analysis(text, clauses)
        if llm_result:
            return llm_result
        return self._heuristic_analysis(text, clauses)

    async def generate_summary(self, text: str) -> ContractSummary:
        result = await self.analyze_contract(text)
        return result.summary

    async def rewrite_clause(self, clause: str, risk_context: str | None = None) -> RewriteClauseResponse:
        llm = self._build_llm()
        if llm:
            prompt = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        "Rewrite risky contract clauses in simpler legal language while preserving the commercial intent and reducing legal exposure. Return JSON with original_clause, safer_alternative, reasoning.",
                    ),
                    ("human", "Clause:\n{clause}\n\nRisk context:\n{risk_context}"),
                ]
            )
            chain = prompt | llm | JsonOutputParser()
            try:
                data = await chain.ainvoke({"clause": clause, "risk_context": risk_context or ""})
                return RewriteClauseResponse.model_validate(data)
            except Exception:
                pass
        return RewriteClauseResponse(
            original_clause=clause,
            safer_alternative=self._safer_alternative(clause, ["SUSPICIOUS_WORDING"]),
            reasoning="The rewrite narrows ambiguous obligations and uses simpler, more balanced language.",
        )

    async def _try_llm_analysis(self, text: str, clauses: list[dict]) -> AnalysisResult | None:
        llm = self._build_llm()
        if not llm:
            return None
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are an enterprise legal contract risk analyzer. Return only valid JSON matching this schema: {schema}. Analyze all clauses for legal, business, fraud, abnormal-language, and suspicious-content risks. Risk levels must be LOW, MEDIUM, HIGH, or CRITICAL. Scores and confidence are integers 0-100. Use concise, specific reasoning. This is risk triage, not legal advice.",
                ),
                (
                    "human",
                    "Contract text:\n{text}\n\nDetected clauses:\n{clauses}\n\nKnown risk flags:\n{flags}",
                ),
            ]
        )
        schema = AnalysisResult.model_json_schema()
        chain = prompt | llm | JsonOutputParser()
        try:
            data = await chain.ainvoke(
                {
                    "schema": json.dumps(schema),
                    "text": text[:70000],
                    "clauses": json.dumps(clauses[:80]),
                    "flags": sorted(RISK_FLAGS),
                }
            )
            return AnalysisResult.model_validate(data)
        except (ValidationError, Exception):
            return None

    def _build_llm(self):
        if not settings.openai_api_key:
            return None
        try:
            from langchain_openai import ChatOpenAI

            return ChatOpenAI(
                model=settings.openai_model,
                temperature=settings.openai_temperature,
                api_key=settings.openai_api_key,
                model_kwargs={"response_format": {"type": "json_object"}},
            )
        except Exception:
            return None

    def _heuristic_analysis(self, text: str, clauses: list[dict]) -> AnalysisResult:
        clause_results = [self._score_clause(clause) for clause in clauses]
        if not clause_results:
            clause_results = [self._score_clause({"title": "Contract Text", "text": text[:5000], "position": 1})]
        score = min(100, round(sum(c.risk_score for c in clause_results) / len(clause_results)))
        score = max(score, max(c.risk_score for c in clause_results))
        fraud = self._fraud_warnings(text)
        if fraud:
            score = min(100, score + 10)
        risk_level = risk_level_from_score(score).value
        return AnalysisResult(
            contract_risk_score=score,
            risk_level=risk_level,
            summary=self._summary(text),
            important_points=self._important_points(clause_results),
            fraud_warnings=fraud,
            clauses=clause_results,
        )

    def _score_clause(self, clause: dict) -> ClauseResult:
        text = clause["text"]
        lowered = text.lower()
        patterns = {
            "UNLIMITED_LIABILITY": r"unlimited liability|liable for all|consequential damages|indirect damages",
            "AUTOMATIC_RENEWAL": r"automatically renew|auto[- ]renew|successive terms",
            "HIDDEN_FEES": r"additional fees|administrative fee|processing fee|charges may apply",
            "TERMINATION_RESTRICTION": r"may not terminate|no right to terminate|termination only by",
            "BROAD_INDEMNIFICATION": r"indemnify.*all|hold harmless|any and all claims",
            "NON_COMPETE": r"non[- ]compete|shall not compete|competitive business",
            "JURISDICTION_RISK": r"exclusive jurisdiction|foreign courts|governing law",
            "CONFIDENTIALITY_IMBALANCE": r"perpetual confidentiality|confidential.*indefinitely",
            "ARBITRATION": r"binding arbitration|waive.*jury|class action waiver",
            "ONE_SIDED_PAYMENT_TERMS": r"payment.*immediate|accelerat.*payment|late fee",
            "IP_OWNERSHIP_ISSUE": r"assigns all intellectual property|work product.*owned",
            "DATA_PRIVACY_CONCERN": r"personal data|data processing|privacy|security breach",
            "VENDOR_LOCK_IN": r"exclusive provider|minimum commitment|early termination fee",
            "CONSUMER_RIGHTS_VIOLATION": r"waive.*rights|no refunds|as is",
        }
        flags = [flag for flag, pattern in patterns.items() if re.search(pattern, lowered)]
        abnormal = []
        if re.search(r"\[.*?\]|____|TBD|to be determined|insert", text, re.I):
            abnormal.append("BLANK_REFERENCES")
        if re.search(r"\b\d{2,3}%\b|penalt(?:y|ies).*%|liquidated damages", text, re.I):
            abnormal.append("RISKY_PERCENTAGE")
        flags.extend(flag for flag in abnormal if flag not in flags)
        severity_weights = {
            "UNLIMITED_LIABILITY": 36,
            "BROAD_INDEMNIFICATION": 30,
            "CONSUMER_RIGHTS_VIOLATION": 28,
            "NON_COMPETE": 22,
            "TERMINATION_RESTRICTION": 22,
            "ONE_SIDED_PAYMENT_TERMS": 20,
            "AUTOMATIC_RENEWAL": 16,
            "HIDDEN_FEES": 16,
            "CONFIDENTIALITY_IMBALANCE": 16,
            "ARBITRATION": 16,
            "JURISDICTION_RISK": 14,
            "IP_OWNERSHIP_ISSUE": 18,
            "DATA_PRIVACY_CONCERN": 18,
            "VENDOR_LOCK_IN": 16,
            "BLANK_REFERENCES": 14,
            "RISKY_PERCENTAGE": 16,
        }
        risk_score = 15 + sum(severity_weights.get(flag, 12) for flag in flags)
        risk_score = min(100, risk_score)
        risk = risk_level_from_score(risk_score).value
        return ClauseResult(
            title=clause["title"],
            text=text,
            risk=risk,
            risk_score=risk_score,
            confidence=85 if flags else 55,
            reason=self._reason(flags),
            legal_reasoning=self._legal_reasoning(flags),
            business_impact=self._business_impact(flags),
            safer_alternative=self._safer_alternative(text, flags),
            flags=flags,
        )

    def _reason(self, flags: list[str]) -> str:
        if not flags:
            return "No major predefined risk pattern was detected, but the clause should still be reviewed in context."
        return "Detected risk indicators: " + ", ".join(flags).replace("_", " ").lower() + "."

    def _legal_reasoning(self, flags: list[str]) -> str:
        if not flags:
            return "The clause does not obviously depart from common contract structures based on automated review."
        return "The clause may shift legal obligations disproportionately, create ambiguous duties, or limit remedies available to the user."

    def _business_impact(self, flags: list[str]) -> str:
        if not flags:
            return "Expected business impact appears limited based on automated pattern detection."
        return "The business may face increased cost, reduced negotiation leverage, operational lock-in, or exposure to claims beyond expected deal value."

    def _safer_alternative(self, text: str, flags: list[str]) -> str:
        if not flags:
            return "Retain the clause but confirm it matches the commercial deal and applicable law."
        return (
            "Replace this provision with balanced language that limits obligations to direct, foreseeable losses; "
            "caps liability at a negotiated amount; preserves reasonable termination rights; excludes hidden charges; "
            "and requires mutual, clearly defined responsibilities."
        )

    def _summary(self, text: str) -> ContractSummary:
        parties = re.findall(r"between\s+(.+?)\s+and\s+(.+?)(?:\.|,|\n)", text, re.I)
        dates = re.findall(r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Z][a-z]+ \d{1,2}, \d{4})\b", text)
        return ContractSummary(
            executive_summary="Automated contract review completed. Review highlighted clauses, fraud warnings, and high-risk obligations before signing.",
            purpose=self._extract_sentence(text, ["purpose", "services", "agreement"]),
            parties_involved=list(parties[0]) if parties else [],
            duration=self._extract_sentence(text, ["term", "duration"]),
            financial_obligations=[self._extract_sentence(text, ["payment", "fee", "invoice"]) or ""],
            termination_conditions=[self._extract_sentence(text, ["terminate", "termination"]) or ""],
            renewal=self._extract_sentence(text, ["renew", "renewal"]),
            important_dates=dates[:10],
            deliverables=[self._extract_sentence(text, ["deliverable", "statement of work", "services"]) or ""],
        )

    def _important_points(self, clauses: list[ClauseResult]) -> list[ImportantPoint]:
        categories = [
            "payment",
            "termination",
            "renewal",
            "penalty",
            "intellectual property",
            "data privacy",
            "confidentiality",
            "liability",
            "governing law",
            "deadline",
        ]
        points: list[ImportantPoint] = []
        for clause in clauses:
            lowered = clause.text.lower()
            for category in categories:
                if category in lowered and len(points) < 20:
                    points.append(
                        ImportantPoint(
                            category=category.upper().replace(" ", "_"),
                            text=clause.text[:500],
                            importance=clause.risk,
                        )
                    )
                    break
        return points

    def _fraud_warnings(self, text: str) -> list[FraudWarning]:
        checks = {
            "BLANK_REFERENCES": r"\[.*?\]|____|TBD|insert .* here",
            "MISSING_SIGNATURES": r"signature:\s*$|signed by:\s*$",
            "IMPOSSIBLE_TIMELINES": r"within 0 days|before the effective date",
            "EXCESSIVE_PENALTIES": r"penalt(?:y|ies).*?(?:50|75|100)%|liquidated damages",
            "UNDEFINED_TERMS": r"as defined herein|defined below",
            "HIDDEN_OBLIGATION": r"notwithstanding anything|sole discretion|without notice",
        }
        warnings = []
        for warning_type, pattern in checks.items():
            match = re.search(pattern, text, re.I | re.M)
            if match:
                warnings.append(
                    FraudWarning(
                        type=warning_type,
                        text=match.group(0)[:300],
                        why_suspicious="This wording can obscure obligations, leave material terms incomplete, or create enforceability and negotiation risk.",
                        severity="HIGH",
                        confidence=80,
                    )
                )
        return warnings

    def _extract_sentence(self, text: str, keywords: list[str]) -> str | None:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        for sentence in sentences:
            if any(keyword in sentence.lower() for keyword in keywords):
                return sentence[:500]
        return None
