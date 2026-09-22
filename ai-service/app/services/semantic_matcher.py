from typing import Protocol

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.core.model_loader import get_embedding_model
from app.schemas.matching_request import MatchingRequest


class EmbeddingModel(Protocol):
    def encode(self, sentences: list[str], **kwargs: object) -> np.ndarray: ...


class SemanticMatcher:
    def __init__(self, model: EmbeddingModel | None = None) -> None:
        self._model = model

    @property
    def model(self) -> EmbeddingModel:
        if self._model is None:
            self._model = get_embedding_model()
        return self._model

    def calculate_similarity(self, request: MatchingRequest) -> float:
        candidate_text = " ".join(
            [
                request.candidate.summary,
                request.candidate.cv_text,
                " ".join(skill.name for skill in request.candidate.skills),
            ]
        )
        job_text = " ".join(
            [
                request.job.title,
                request.job.description,
                " ".join(item.content for item in request.job.requirements),
            ]
        )
        embeddings = np.asarray(
            self.model.encode([candidate_text, job_text], normalize_embeddings=True), dtype=float
        )
        if embeddings.shape[0] != 2:
            raise ValueError("Embedding model must return one vector per input text")
        similarity = float(cosine_similarity(embeddings[0:1], embeddings[1:2])[0, 0])
        return round(max(0.0, min(1.0, similarity)), 4)
