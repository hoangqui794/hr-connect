from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All tunable numbers live here (no hard-coded business values in the pipeline)."""

    app_name: str = "HR Connect AI Service v2"

    # LLM that reads the CV and judges each requirement: gemini | openai | anthropic.
    # Keys come from the environment (.env): GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY.
    llm_provider: str = "gemini"
    gemini_model: str = "gemini-3.8-flash"
    gemini_api_key: str = ""
    # Same key, other models (comma-separated), used in order when the model above is rate limited.
    gemini_fallback_models: str = ""
    openai_model: str = "gpt-5.4-mini"
    openai_api_key: str = ""
    # Comma-separated providers tried in order when LLM_PROVIDER fails, e.g. "openai".
    llm_fallback_providers: str = ""
    llm_model: str = "claude-opus-5-5"
    llm_effort: str = "medium"
    llm_max_tokens: int = 16000
    llm_timeout_seconds: float = 120.0
    llm_max_attempts: int = 3
    llm_retry_wait_seconds: float = 20.0
    # 0 = most repeatable judgements (Gemini; seed fixes the remaining sampling).
    llm_temperature: float = 0.0
    llm_seed: int = 7

    # Sentence-BERT semantic score (kept from v1, as the thesis requires embeddings).
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    semantic_chunk_chars: int = 350
    semantic_floor: float = 0.10
    semantic_ceiling: float = 0.55

    # Score formula. EXPERIMENTAL weights, same defaults as v1 so results are comparable.
    must_have_weight: float = 0.50
    should_have_weight: float = 0.20
    semantic_weight: float = 0.15
    llm_fit_weight: float = 0.15
    partial_credit: float = 0.5
    knockout_score_cap: float = 59.0
    semantic_gated_by_must_have: bool = True

    # Experience a little under the JD minimum still counts as met (0.25 = about 3 months).
    years_tolerance: float = 0.25

    # Quote verification: share of quote tokens that must appear, in order, in the CV text.
    quote_min_token_ratio: float = 0.85

    max_upload_size_mb: int = 10

    # HR Connect backend integration (same contract and env names as v1).
    hrconnect_base_url: str = "http://127.0.0.1:5000"
    hrconnect_service_token: str = ""
    hrconnect_verify_ssl: bool = True
    internal_request_timeout_seconds: float = 30.0
    # Posting the AI result back is retried on network errors, 429 and 5xx (Render restarts, cold starts),
    # waiting base, 2x base, 4x base... A 4xx other than 429 is a real rejection and is not retried.
    callback_retry_attempts: int = 5
    callback_retry_base_seconds: float = 2.0
    # Jobs accepted but not finished are kept in this file and re-queued on start, so a restart loses none.
    # Empty disables it.
    scoring_queue_file: str = ".data/pending-scoring-jobs.json"
    scoring_queue_size: int = 100
    # One worker keeps LLM calls within provider rate limits.
    scoring_worker_count: int = 1
    # Whole scoring job (download + LLM with retries + scoring). Past it the backend gets FAILED / AI_TIMEOUT
    # and routes the application to manual review instead of waiting forever.
    scoring_job_timeout_seconds: float = 300.0

    # /api/v1/match-file and /docs are for local testing only. When false (default, and on Render) match-file
    # needs the X-Service-Token and the API docs are not served, so nobody can spend the LLM quota.
    allow_unauthenticated_test_endpoints: bool = False
    # Serves /docs, /redoc and /openapi.json without opening any endpoint: /match-file still needs the
    # X-Service-Token unless allow_unauthenticated_test_endpoints is also true. Off by default.
    api_docs_enabled: bool = False

    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def gemini_fallback_model_list(self) -> list[str]:
        return [name.strip() for name in self.gemini_fallback_models.split(",") if name.strip()]

    @property
    def active_model(self) -> str:
        return {"gemini": self.gemini_model, "openai": self.openai_model}.get(self.llm_provider.lower(), self.llm_model)

    @model_validator(mode="after")
    def _weights_sum_to_one(self) -> "Settings":
        total = self.must_have_weight + self.should_have_weight + self.semantic_weight + self.llm_fit_weight
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"Score weights must total 1.0, got {total}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
