from enum import StrEnum


class UserRole(StrEnum):
    USER = "USER"
    ADMIN = "ADMIN"


class ContractStatus(StrEnum):
    UPLOADED = "UPLOADED"
    PARSING = "PARSING"
    PARSED = "PARSED"
    ANALYZING = "ANALYZING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class FileType(StrEnum):
    PDF = "PDF"
    DOCX = "DOCX"
    TXT = "TXT"


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ReportFormat(StrEnum):
    JSON = "json"
    MARKDOWN = "markdown"
    PDF = "pdf"


RISK_FLAGS = {
    "UNLIMITED_LIABILITY",
    "AUTOMATIC_RENEWAL",
    "HIDDEN_FEES",
    "TERMINATION_RESTRICTION",
    "BROAD_INDEMNIFICATION",
    "NON_COMPETE",
    "JURISDICTION_RISK",
    "CONFIDENTIALITY_IMBALANCE",
    "ARBITRATION",
    "ONE_SIDED_PAYMENT_TERMS",
    "IP_OWNERSHIP_ISSUE",
    "DATA_PRIVACY_CONCERN",
    "VENDOR_LOCK_IN",
    "CONSUMER_RIGHTS_VIOLATION",
    "SUSPICIOUS_WORDING",
    "ABNORMAL_LEGAL_LANGUAGE",
    "CONTRADICTORY_CLAUSES",
    "CONFLICTING_DATES",
    "MISSING_SIGNATURES",
    "IMPOSSIBLE_TIMELINES",
    "EXCESSIVE_PENALTIES",
    "BLANK_REFERENCES",
    "UNDEFINED_TERMS",
    "SCAM_INDICATOR",
    "HIDDEN_OBLIGATION",
    "RISKY_PERCENTAGE",
    "ONE_SIDED_RESPONSIBILITY",
}


def risk_level_from_score(score: int) -> RiskLevel:
    if score >= 85:
        return RiskLevel.CRITICAL
    if score >= 65:
        return RiskLevel.HIGH
    if score >= 35:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW
