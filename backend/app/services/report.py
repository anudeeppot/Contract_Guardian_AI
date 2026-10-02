import json
from io import BytesIO

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

from app.db.models import Analysis


class ReportService:
    def to_json_bytes(self, analysis: Analysis) -> bytes:
        return json.dumps(self._as_dict(analysis), indent=2, default=str).encode("utf-8")

    def to_markdown_bytes(self, analysis: Analysis) -> bytes:
        data = self._as_dict(analysis)
        lines = [
            "# Contract Guardian AI Report",
            "",
            f"Risk Score: {data['contractRiskScore']}",
            f"Risk Level: {data['riskLevel']}",
            "",
            "## Executive Summary",
            data["summary"].get("executive_summary", ""),
            "",
            "## Fraud Warnings",
        ]
        for warning in data["fraudWarnings"]:
            lines.append(f"- **{warning['severity']}** {warning['type']}: {warning['why_suspicious']}")
        lines.extend(["", "## Clauses"])
        for clause in data["clauses"]:
            lines.extend(
                [
                    f"### {clause['title']}",
                    f"Risk: {clause['risk']} ({clause['riskScore']}/100)",
                    clause["reason"],
                    "",
                    "**Safer Alternative**",
                    clause["saferAlternative"],
                    "",
                ]
            )
        return "\n".join(lines).encode("utf-8")

    def to_pdf_bytes(self, analysis: Analysis) -> bytes:
        data = self._as_dict(analysis)
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=LETTER)
        width, height = LETTER
        y = height - 50
        for line in [
            "Contract Guardian AI Report",
            f"Risk Score: {data['contractRiskScore']}",
            f"Risk Level: {data['riskLevel']}",
            data["summary"].get("executive_summary", ""),
        ]:
            pdf.drawString(50, y, line[:95])
            y -= 20
        for clause in data["clauses"][:25]:
            if y < 80:
                pdf.showPage()
                y = height - 50
            pdf.drawString(50, y, f"{clause['title']} - {clause['risk']} - {clause['reason'][:70]}")
            y -= 18
        pdf.save()
        return buffer.getvalue()

    def _as_dict(self, analysis: Analysis) -> dict:
        return {
            "analysisId": str(analysis.id),
            "contractId": str(analysis.contract_id),
            "contractRiskScore": analysis.contract_risk_score,
            "riskLevel": analysis.risk_level,
            "summary": analysis.summary,
            "importantPoints": analysis.important_points,
            "fraudWarnings": analysis.fraud_warnings,
            "clauses": [
                {
                    "title": clause.title,
                    "text": clause.text,
                    "risk": clause.risk,
                    "riskScore": clause.risk_score,
                    "confidence": clause.confidence,
                    "reason": clause.reason,
                    "legalReasoning": clause.legal_reasoning,
                    "businessImpact": clause.business_impact,
                    "saferAlternative": clause.safer_alternative,
                    "flags": clause.flags,
                }
                for clause in sorted(analysis.clauses, key=lambda item: item.position)
            ],
        }
