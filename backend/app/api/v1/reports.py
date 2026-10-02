from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import current_user
from app.core.constants import ReportFormat
from app.core.errors import bad_request
from app.db.models import User
from app.db.session import get_db
from app.schemas.reports import DownloadReportRequest
from app.services.analysis import AnalysisService
from app.services.report import ReportService

router = APIRouter(tags=["Reports"])


@router.post("/download-report")
async def download_report(
    payload: DownloadReportRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis = await AnalysisService(db).get(UUID(payload.analysis_id), user.id)
    reports = ReportService()
    fmt = payload.format.lower()
    if fmt == ReportFormat.JSON.value:
        return Response(
            content=reports.to_json_bytes(analysis),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=contract-analysis.json"},
        )
    if fmt == ReportFormat.MARKDOWN.value:
        return Response(
            content=reports.to_markdown_bytes(analysis),
            media_type="text/markdown",
            headers={"Content-Disposition": "attachment; filename=contract-analysis.md"},
        )
    if fmt == ReportFormat.PDF.value:
        return Response(
            content=reports.to_pdf_bytes(analysis),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=contract-analysis.pdf"},
        )
    raise bad_request("UNSUPPORTED_REPORT_FORMAT", "Report format must be json, markdown, or pdf")
