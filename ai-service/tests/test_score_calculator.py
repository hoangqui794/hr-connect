from app.schemas.matching_request import RequirementType
from app.schemas.matching_response import RequirementMatch
from app.services.score_calculator import ScoreCalculator


def _result(status: str, coverage: float) -> RequirementMatch:
    return RequirementMatch(
        requirement="Three years of experience",
        type=RequirementType.MUST_HAVE,
        matched=status == "MATCHED",
        matchStatus=status,
        evidenceCoverage=coverage,
        similarity=coverage,
        matchMethod=(
            "DETERMINISTIC"
            if status == "MATCHED"
            else "UNKNOWN"
            if status == "UNKNOWN"
            else "NOT_FOUND"
        ),
    )


def test_unknown_evidence_cannot_inflate_score_through_semantic_similarity() -> None:
    calculator = ScoreCalculator()

    unknown_score = calculator.calculate([_result("UNKNOWN", 0.0)], [], 1.0)
    reliable_absence_score = calculator.calculate([_result("NOT_FOUND", 0.0)], [], 1.0)

    assert unknown_score == 20.0
    # Semantic similarity is gated by MUST_HAVE coverage, so a missing
    # requirement earns no semantic credit either.
    assert reliable_absence_score == 20.0
    assert unknown_score <= reliable_absence_score


def test_semantic_credit_scales_with_must_have_coverage(monkeypatch) -> None:
    from app.core.config import get_settings

    half = [_result("MATCHED", 1.0), _result("NOT_FOUND", 0.0)]
    gated = ScoreCalculator().calculate(half, [], 1.0)
    monkeypatch.setenv("SEMANTIC_GATED_BY_MUST_HAVE", "false")
    get_settings.cache_clear()
    try:
        ungated = ScoreCalculator().calculate(half, [], 1.0)
    finally:
        get_settings.cache_clear()

    assert gated == 60.0  # 0.5*50 + 1.0*20 + (1.0*0.5)*30
    assert ungated == 75.0  # 0.5*50 + 1.0*20 + 1.0*30
