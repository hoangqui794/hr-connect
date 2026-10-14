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
    openai_model: str = "gpt-6-astra"
    llm_model: str = "claude-opus-5-5"
    llm_effort: str = "medium"
    llm_max_tokens: int = 16000
    llm_timeout_seconds: float = 120.0
    llm_max_attempts: int = 3
    llm_retry_wait_seconds: float = 20.0

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

    # Quote verification: share of quote tokens that must appear, in order, in the CV text.
    quote_min_token_ratio: float = 0.85

    max_upload_size_mb: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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
