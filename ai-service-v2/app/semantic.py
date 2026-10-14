"""Sentence-BERT similarity between CV and JD (same method as v1: chunked max-similarity, rescaled)."""

from __future__ import annotations

import re
from functools import lru_cache

import numpy as np

from app.config import Settings
from app.schemas import Job


def chunk_text(text: str, max_chars: int) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?;])\s+|\n+", text) if s.strip()]
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        if current and len(current) + 1 + len(sentence) > max_chars:
            chunks.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        chunks.append(current)
    return [chunk[:max_chars] for chunk in chunks]


@lru_cache
def _load_model(name: str):
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(name)


class SemanticMatcher:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def similarity(self, cv_text: str, job: Job) -> float:
        job_chunks = chunk_text(f"{job.title}. {job.description}", self._settings.semantic_chunk_chars)
        job_chunks += [requirement.content for requirement in job.requirements]
        cv_chunks = chunk_text(cv_text, self._settings.semantic_chunk_chars)
        if not job_chunks or not cv_chunks:
            return 0.0

        model = _load_model(self._settings.embedding_model)
        job_vectors = model.encode(job_chunks, normalize_embeddings=True)
        cv_vectors = model.encode(cv_chunks, normalize_embeddings=True)
        best = (np.asarray(job_vectors) @ np.asarray(cv_vectors).T).max(axis=1)
        raw = float(best.mean())
        return rescale(raw, self._settings.semantic_floor, self._settings.semantic_ceiling)


def rescale(value: float, floor: float, ceiling: float) -> float:
    if ceiling <= floor:
        return 0.0
    return round(min(1.0, max(0.0, (value - floor) / (ceiling - floor))), 4)
