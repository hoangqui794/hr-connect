from app.core.config import Settings, get_settings
from app.schemas.matching_response import RequirementMatch


def _ratio(results: list[RequirementMatch]) -> float:
    if not results:
        return 1.0
    return sum(item.matched for item in results) / len(results)


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
        weighted = (
            _ratio(must_have) * self.settings.must_have_weight
            + _ratio(should_have) * self.settings.should_have_weight
            + semantic_score * self.settings.semantic_weight
        )
        return round(max(0.0, min(100.0, weighted * 100)), 2)
