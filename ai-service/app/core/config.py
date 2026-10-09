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
    log_level: str = "INFO"
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    must_have_weight: float = 0.50
    should_have_weight: float = 0.20
    semantic_weight: float = 0.30
    semantic_match_threshold: float = 0.35
    # Raw chunk similarity is rescaled from [floor, ceiling] to [0, 1]. Values are
    # model-specific; calibrate with tools/benchmark_embedding_models.py.
    semantic_floor: float = Field(default=0.10, ge=0, le=1)
    semantic_ceiling: float = Field(default=0.55, ge=0, le=1)
    # Empty uses app/data/capability_lexicon.json.
    capability_lexicon_path: str = ""
    # Semantic partial credit for unresolved OTHER requirements: never MATCHED,
    # always flagged for review. Set the credit to 0 to disable.
    evidence_credit_threshold: float = Field(default=0.65, ge=0, le=1)
    evidence_partial_credit: float = Field(default=0.5, ge=0, le=1)
    # Optional cross-encoder that re-scores evidence spans (e.g.
    # cross-encoder/mmarco-mMiniLMv2-L12-H384-v1). Empty disables it.
    reranker_model: str = ""
    reranker_credit_threshold: float = Field(default=0.5, ge=0, le=1)
    # Highest score a CV can get while a knockout MUST_HAVE is not fully met.
    knockout_score_cap: float = Field(default=59, ge=0, le=100)
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
    # Production must verify the HR Connect TLS certificate. Local development
    # can explicitly opt out in .env when using the ASP.NET dev certificate.
    hrconnect_verify_ssl: bool = True
    # Standalone parse/match endpoints expose CV-derived data and consume model
    # capacity. They are protected by default; only local development may opt in
    # to unauthenticated access.
    allow_unauthenticated_test_endpoints: bool = False
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
        if self.semantic_floor >= self.semantic_ceiling:
            raise ValueError("SEMANTIC_FLOOR must be lower than SEMANTIC_CEILING")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
