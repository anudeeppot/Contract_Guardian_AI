from functools import lru_cache
from pathlib import Path
import tempfile

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Contract Guardian AI"
    app_env: str = "local"
    api_v1_prefix: str = "/api/v1"
    # database_url: str = "sqlite+aiosqlite:///./contract_guardian.db"
    database_url: str = "mysql+aiomysql://cgaiuser:1234@localhost/CONTRACT_GUARDIAN_AI"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    upload_dir: Path = Path(tempfile.gettempdir()) / "contract-guardian" / "uploads"
    report_dir: Path = Path(tempfile.gettempdir()) / "contract-guardian" / "reports"
    max_upload_size_mb: int = 25
    allowed_upload_extensions: list[str] = ["pdf", "docx", "txt"]

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_temperature: float = 0.1
    ocr_enabled: bool = False

    # MongoDB (CO2 - polyglot persistence)
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "contract_guardian"
    mongodb_enabled: bool = True

    # Vector search (CO2)
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    vector_search_top_k: int = 5
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Pinecone (CO2 - optional adapter)
    pinecone_api_key: str | None = None
    pinecone_index: str = "contract-guardian"
    pinecone_environment: str = "us-east-1"

    # Weaviate (CO2 - optional adapter)
    weaviate_url: str = "http://localhost:8080"
    weaviate_api_key: str | None = None

    # Observability (CO6)
    otel_enabled: bool = False
    otel_endpoint: str = "http://localhost:4317"
    prometheus_enabled: bool = True

    # Rate limiting (CO3)
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ]
    log_level: str = "INFO"

    @field_validator("allowed_upload_extensions", "cors_origins", mode="before")
    @classmethod
    def parse_csv(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def is_postgres(self) -> bool:
        return "postgresql" in self.database_url or "postgres" in self.database_url


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.report_dir.mkdir(parents=True, exist_ok=True)
    return settings


settings = get_settings()
