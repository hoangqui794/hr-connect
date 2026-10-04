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
    assert reliable_absence_score == 50.0
