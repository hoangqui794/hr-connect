from typing import Protocol

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.core.model_loader import get_embedding_model
from app.schemas.matching_request import MatchingRequest
from app.services.requirement_evidence import evidence_spans


class EmbeddingModel(Protocol):
    def encode(self, sentences: list[str], **kwargs: object) -> np.ndarray: ...


class SemanticMatcher:
    def retrieve_evidence(self, queries: list[str], cv_text: str) -> list[list[dict]]:
        """Bounded, batched retrieval for human review; never changes a verdict."""
        spans = evidence_spans(cv_text)
        if not queries or not spans:
            return [[] for _ in queries]
        # Keep the most relevant lexical spans plus uniformly sampled coverage
        # when a document exceeds the bounded inference budget.
        if len(spans) > 256:
            indices = np.linspace(0, len(spans) - 1, 256, dtype=int)
            spans = [spans[index] for index in indices]
        vectors = np.asarray(self.model.encode(queries + [s["text"] for s in spans], normalize_embeddings=True), dtype=float)
        if vectors.ndim != 2 or vectors.shape[0] != len(queries) + len(spans) or not np.isfinite(vectors).all():
            raise ValueError("Invalid evidence embedding batch")
        scores = cosine_similarity(vectors[:len(queries)], vectors[len(queries):])
        return [[{**spans[int(i)], "similarity": round(float(row[i]), 4), "verified": False}
                 for i in np.argsort(-row, kind="stable")[:3]] for row in scores]

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
