"""Deterministic score from verified per-requirement statuses. The LLM never sets the number."""

from __future__ import annotations

from app.config import Settings
from app.schemas import MatchStatus, RequirementResult, RequirementType


def credit(status: MatchStatus, settings: Settings) -> float:
    if status == MatchStatus.MATCHED:
        return 1.0
    if status == MatchStatus.PARTIAL:
        return settings.partial_credit
    return 0.0  # NOT_FOUND and UNKNOWN (UNKNOWN also forces manual review)


def coverage(results: list[RequirementResult], settings: Settings) -> float:
    if not results:
        return 1.0
    return sum(credit(result.match_status, settings) for result in results) / len(results)


def fit_score(level: int) -> float:
    return round((min(5, max(1, level)) - 1) / 4, 4)


def compute_score(
    must: list[RequirementResult],
    should: list[RequirementResult],
    semantic: float,
    settings: Settings,
    fit: float = 0.0,
) -> float:
    must_coverage = coverage(must, settings)
    should_coverage = coverage(should, settings) if should else must_coverage
    semantic_part = semantic * (must_coverage if settings.semantic_gated_by_must_have else 1.0)
    score = 100 * (
        settings.must_have_weight * must_coverage
        + settings.should_have_weight * should_coverage
        + settings.semantic_weight * semantic_part
        + settings.llm_fit_weight * fit
    )
    # A MUST_HAVE that is clearly absent caps the score below the usual shortlist band.
    if any(result.match_status == MatchStatus.NOT_FOUND for result in must):
        score = min(score, settings.knockout_score_cap)
    return round(score, 2)


def split_by_type(results: list[RequirementResult]) -> tuple[list[RequirementResult], list[RequirementResult]]:
    must = [result for result in results if result.type == RequirementType.MUST_HAVE]
    should = [result for result in results if result.type == RequirementType.SHOULD_HAVE]
    return must, should
