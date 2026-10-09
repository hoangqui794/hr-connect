from app.core.config import Settings, get_settings
from app.schemas.matching_response import RequirementMatch


def _ratio(results: list[RequirementMatch]) -> float:
    if not results:
        return 1.0
    return sum(item.evidence_coverage for item in results) / len(results)


class ScoreCalculator:
    """EXPERIMENTAL ONLY: this formula is not an approved business rule."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def calculate(
        self,
        must_have: list[RequirementMatch],
        should_have: list[RequirementMatch],
        semantic_score: float,
    ) -> float:
        has_unknown = any(
            item.match_status == "UNKNOWN" for item in [*must_have, *should_have]
        )
        effective_semantic_score = 0.0 if has_unknown else semantic_score
        must_ratio = _ratio(must_have)
        if self.settings.semantic_gated_by_must_have:
            # Topic similarity rewards candidates who meet the hard requirements;
            # it must not make up for them (any IT CV "resembles" any IT job).
            effective_semantic_score *= must_ratio
        weighted = (
            must_ratio * self.settings.must_have_weight
            + _ratio(should_have) * self.settings.should_have_weight
            + effective_semantic_score * self.settings.semantic_weight
        )
        score = max(0.0, min(100.0, weighted * 100))
        if any(
            (item.knockout and item.match_status != "MATCHED") or (item.core and item.match_status == "NOT_FOUND")
            for item in must_have
        ):
            score = min(score, self.settings.knockout_score_cap)
        return round(score, 2)
