from app.schemas.matching_request import MatchingRequest
from app.services.normalizer import normalize_request
from app.services.requirement_matcher import RequirementMatcher


def test_requirement_matcher_keeps_missing_must_have_deterministic(load_fixture) -> None:
    request = MatchingRequest.model_validate(load_fixture("missing_must_have.json"))

    must_have, should_have = RequirementMatcher().match(normalize_request(request))

    assert should_have == []
    assert must_have[0].matched is True
    assert must_have[0].match_method == "DETERMINISTIC"
    assert must_have[1].requirement == "redis"
    assert must_have[1].matched is False
    assert must_have[1].similarity == 0
    assert must_have[1].match_method == "NOT_FOUND"


def test_requirement_matcher_normalizes_and_deduplicates_skills(load_fixture) -> None:
    payload = load_fixture("strong_match.json")
    payload["candidate"]["skills"].append({"name": "asp.net   core", "yearsOfExperience": 1})
    request = normalize_request(MatchingRequest.model_validate(payload))

    must_have, _ = RequirementMatcher().match(request)

    assert len([skill for skill in request.candidate.skills if skill.name == "asp.net core"]) == 1
    assert must_have[0].matched is True
