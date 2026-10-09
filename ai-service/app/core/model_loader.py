from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """Load the configured embedding model lazily and reuse the same model for all requests."""

    return SentenceTransformer(get_settings().embedding_model)


@lru_cache(maxsize=1)
def get_reranker_model():
    """Optional cross-encoder for evidence spans; None when RERANKER_MODEL is empty."""

    name = get_settings().reranker_model
    if not name:
        return None
    import torch
    from sentence_transformers import CrossEncoder

    # Many rerankers ship with an identity head (raw logits); force probabilities.
    return CrossEncoder(name, activation_fn=torch.nn.Sigmoid())
