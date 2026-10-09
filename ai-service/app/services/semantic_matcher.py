from typing import Protocol

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import get_settings
from app.core.model_loader import get_embedding_model, get_reranker_model
from app.schemas.matching_request import MatchingRequest
from app.services.requirement_evidence import evidence_spans, is_supported_span


class EmbeddingModel(Protocol):
    def encode(self, sentences: list[str], **kwargs: object) -> np.ndarray: ...


class RerankerModel(Protocol):
    """Returns a relevance probability in [0, 1] per (query, passage) pair."""

    def predict(self, pairs: list[tuple[str, str]], **kwargs: object) -> np.ndarray: ...


_RERANK_CANDIDATES = 10


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
        reranker = self.reranker
        results = []
        for query, row in zip(queries, scores):
            order = [int(i) for i in np.argsort(-row, kind="stable")]
            if reranker is None:
                results.append([{**spans[i], "similarity": round(float(row[i]), 4), "verified": False} for i in order[:3]])
                continue
            # The cross-encoder reads query and span together, so it re-orders
            # the bi-encoder's shortlist more precisely.
            shortlist = order[:_RERANK_CANDIDATES]
            # get_reranker_model loads the cross-encoder with a sigmoid head.
            probabilities = np.clip(
                np.asarray(reranker.predict([(query, spans[i]["text"]) for i in shortlist]), dtype=float).reshape(-1), 0, 1
            )
            ranked = sorted(zip(shortlist, probabilities), key=lambda pair: -pair[1])[:3]
            results.append([
                {**spans[i], "similarity": round(float(row[i]), 4), "rerankScore": round(float(p), 4), "verified": False}
                for i, p in ranked
            ])
        return results

    def best_supported_evidence(self, suggestions: list[dict]) -> tuple[dict | None, float]:
        """Strongest suggestion that is not an aspiration/negation, and its score."""
        for suggestion in suggestions:
            if is_supported_span(suggestion["text"]):
                return suggestion, float(suggestion.get("rerankScore", suggestion["similarity"]))
        return None, 0.0

    def __init__(self, model: EmbeddingModel | None = None, reranker: RerankerModel | None = None) -> None:
        self._model = model
        self._reranker = reranker

    @property
    def model(self) -> EmbeddingModel:
        if self._model is None:
            self._model = get_embedding_model()
        return self._model

    @property
    def reranker(self) -> RerankerModel | None:
        if self._reranker is None:
            self._reranker = get_reranker_model()
        return self._reranker

    def calculate_similarity(self, request: MatchingRequest) -> float:
        """How well the CV covers the job, robust to the encoder's input limit.

        Short-context encoders (MiniLM reads 128 tokens) silently truncate a
        whole CV, so both sides are split into chunks. Each job chunk takes its
        best-matching CV chunk; the mean over job chunks is rescaled from
        [SEMANTIC_FLOOR, SEMANTIC_CEILING] to [0, 1].
        """
        candidate_chunks = _chunk(
            "\n".join(
                [
                    request.candidate.summary,
                    request.candidate.cv_text,
                    ", ".join(skill.name for skill in request.candidate.skills),
                ]
            )
        )
        job_chunks = _chunk(f"{request.job.title}. {request.job.description}") + [
            item.content for item in request.job.requirements
        ]
        if not candidate_chunks or not job_chunks:
            return 0.0
        embeddings = np.asarray(
            self.model.encode(job_chunks + candidate_chunks, normalize_embeddings=True), dtype=float
        )
        if embeddings.ndim != 2 or embeddings.shape[0] != len(job_chunks) + len(candidate_chunks):
            raise ValueError("Embedding model must return one vector per input text")
        scores = cosine_similarity(embeddings[: len(job_chunks)], embeddings[len(job_chunks) :])
        raw = float(scores.max(axis=1).mean())
        settings = get_settings()
        calibrated = (raw - settings.semantic_floor) / (settings.semantic_ceiling - settings.semantic_floor)
        return round(max(0.0, min(1.0, calibrated)), 4)


_CHUNK_CHARS = 350
_MAX_CHUNKS = 256


def _chunk(text: str) -> list[str]:
    """Group sentence/bullet spans into chunks short enough for the encoder."""
    chunks: list[str] = []
    current = ""
    for span in evidence_spans(text):
        value = span["text"]
        if current and len(current) + len(value) + 1 > _CHUNK_CHARS:
            chunks.append(current)
            current = ""
        current = f"{current} {value}".strip() if current else value[: _CHUNK_CHARS * 2]
    if current:
        chunks.append(current)
    if len(chunks) > _MAX_CHUNKS:
        indices = np.linspace(0, len(chunks) - 1, _MAX_CHUNKS, dtype=int)
        chunks = [chunks[index] for index in indices]
    return chunks
