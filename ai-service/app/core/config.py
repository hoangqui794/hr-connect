from functools import lru_cache
from math import isclose

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings. Scoring weights are experimental, not business rules."""

    app_name: str = "HR Connect AI Service"
    app_version: str = "1.0.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8001
    embedding_model: str = "BAAI/bge-m3"
    must_have_weight: float = 0.50
    should_have_weight: float = 0.20
    semantic_weight: float = 0.30
    semantic_match_threshold: float = 0.65
    max_upload_size_mb: int = Field(default=10, ge=1, le=50)
    max_pdf_pages: int = Field(default=20, ge=1, le=200)
    max_image_pixels: int = Field(default=40_000_000, ge=1_000_000)
    max_extracted_text_chars: int = Field(default=100_000, ge=1_000)
    max_docx_entries: int = Field(default=2_000, ge=10)
    max_docx_uncompressed_mb: int = Field(default=50, ge=1, le=500)
    pdf_text_min_chars_per_page: int = Field(default=30, ge=0)
    ocr_languages: str = "vi,en"
    ocr_max_concurrency: int = Field(default=1, ge=1, le=8)
    hrconnect_base_url: str = "https://localhost:7289"
    hrconnect_service_token: str = ""
    scoring_worker_count: int = Field(default=1, ge=1, le=8)
    scoring_queue_size: int = Field(default=2000, ge=1, le=10000)
    internal_request_timeout_seconds: int = Field(default=30, ge=5, le=300)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def validate_scoring_configuration(self) -> "Settings":
        weights = (self.must_have_weight, self.should_have_weight, self.semantic_weight)
        if any(weight < 0 or weight > 1 for weight in weights):
            raise ValueError("Scoring weights must be between 0 and 1")
        if not isclose(sum(weights), 1.0, abs_tol=1e-9):
            raise ValueError("Scoring weights must total 1.0")
        if not 0 <= self.semantic_match_threshold <= 1:
            raise ValueError("SEMANTIC_MATCH_THRESHOLD must be between 0 and 1")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
