from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """Load BGE-M3 lazily and reuse the same model for all requests."""

    return SentenceTransformer(get_settings().embedding_model)
