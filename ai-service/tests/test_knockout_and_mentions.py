from app.schemas.matching_request import MatchingRequest
from app.schemas.matching_response import RequirementMatch
from app.schemas.matching_request import RequirementType
from app.services.normalizer import normalize_request
from app.services.requirement_evidence import evidence_spans
from app.services.requirement_matcher import RequirementMatcher
from app.services.score_calculator import ScoreCalculator
from tests.test_requirement_evidence import evaluate

# Long enough that mention counting applies; none of these lines mention .NET.
_FILLER = "\n".join(
    f"Delivered feature {index} for the billing platform using TypeScript, React, Node.js and PostgreSQL."
    for index in range(12)
)


def _skill_match(cv_text: str, skills: list[dict] | None = None) -> RequirementMatch:
    request = MatchingRequest.model_validate({
        "requestId": "r", "applicationId": "a", "attemptNo": 1,
        "candidate": {"summary": "Engineer", "cvText": cv_text, "skills": skills or []},
        "job": {"title": "Role", "description": "Role", "requirements": [
            {"type": "MUST_HAVE", "category": "SKILL", "content": ".NET", "knockout": True}
        ]},
    })
    return RequirementMatcher().match(normalize_request(request))[0][0]


def test_single_passing_mention_in_prose_is_not_a_skill() -> None:
    text = f"{_FILLER}\nConverted a small 2D game from Java to .NET in one night as a weekend experiment."

    result = _skill_match(text)

    assert result.match_status == "NOT_FOUND"
    assert "WEAK_SINGLE_MENTION" in result.warnings
    assert result.requires_manual_review is True


def test_skill_in_a_tech_stack_line_still_counts() -> None:
    result = _skill_match(f"{_FILLER}\nTech stack: .NET 8, Angular, SQL Server")

    assert result.match_status == "MATCHED"


def test_declared_skill_with_years_is_not_discounted() -> None:
    text = f"{_FILLER}\nConverted a small 2D game from Java to .NET in one night as a weekend experiment."

    result = _skill_match(text, [{"name": ".NET", "yearsOfExperience": 3}])

    assert result.match_status == "MATCHED"


def test_failed_knockout_caps_score_and_is_flagged() -> None:
    result = _skill_match(_FILLER)
    passing = RequirementMatch(
        requirement="react", type=RequirementType.MUST_HAVE, matched=True, matchStatus="MATCHED",
        evidenceCoverage=1.0, similarity=1.0, matchMethod="DETERMINISTIC",
    )

    capped = ScoreCalculator().calculate([result, passing, passing, passing], [], 1.0)
    uncapped = ScoreCalculator().calculate([passing, passing, passing, passing], [], 1.0)

    assert result.knockout is True
    assert "KNOCKOUT_NOT_MET" in result.warnings
    assert capped == 59
    assert uncapped == 100


def test_soft_wrapped_sentence_is_rejoined_with_offsets_intact() -> None:
    text = "Cut response time from 3+\nseconds to sub 100ms.\nBuilt dashboards."

    spans = evidence_spans(text)

    assert spans[0]["text"] == "Cut response time from 3+ seconds to sub 100ms."
    assert text[spans[0]["start"]:spans[0]["end"]].replace("\n", " ") == spans[0]["text"]
    assert spans[1]["text"] == "Built dashboards."


def test_capitalized_next_line_is_not_joined() -> None:
    spans = evidence_spans("Senior Engineer\nLed the platform team")

    assert [span["text"] for span in spans] == ["Senior Engineer", "Led the platform team"]


def test_lexicon_accepts_component_library_and_technical_decisions() -> None:
    assert evaluate(
        "Build and standardize reusable frontend codebases",
        "Set up the frontend project structure.\nBuilt a fully type-safe component library for the frontend.",
    ).match_status == "MATCHED"
    assert evaluate(
        "Proactive technical solution proposals",
        "Led technical decisions and evaluated technical/UX tradeoffs.",
    ).match_status == "MATCHED"
