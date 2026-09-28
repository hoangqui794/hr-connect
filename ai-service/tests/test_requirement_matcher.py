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


def test_requirement_matcher_uses_structured_experience_and_education() -> None:
    request = MatchingRequest.model_validate({
        "requestId": "experience-education-001",
        "applicationId": "application-001",
        "attemptNo": 1,
        "candidate": {
            "summary": "Backend developer",
            "yearsOfExperience": 3,
            "highestEducation": "Bachelor of Software Engineering",
            "skills": [],
            "cvText": "Backend APIs and PostgreSQL",
        },
        "job": {
            "title": "Backend Developer",
            "description": "Build APIs",
            "requirements": [
                {"type": "MUST_HAVE", "category": "EXPERIENCE", "content": "At least 2 years of backend experience"},
                {"type": "SHOULD_HAVE", "category": "EDUCATION", "content": "Bachelor in Software Engineering or related field"},
            ],
        },
    })

    must_have, should_have = RequirementMatcher().match(normalize_request(request))

    assert must_have[0].matched is True
    assert must_have[0].evidence == "3 years of experience"
    assert should_have[0].matched is True


def test_requirement_matcher_extracts_skill_from_long_jd_sentence() -> None:
    request = MatchingRequest.model_validate({
        "requestId": "long-skill-001",
        "applicationId": "application-001",
        "attemptNo": 1,
        "candidate": {
            "summary": "Backend developer",
            "skills": [{"name": "ASP.NET Core"}],
            "cvText": "Built APIs with ASP.NET Core.",
        },
        "job": {
            "title": "Backend Developer",
            "description": "Build APIs",
            "requirements": [{
                "type": "MUST_HAVE",
                "category": "SKILL",
                "content": "Proficiency in C#, ASP.NET Core, and building RESTful Web APIs.",
            }],
        },
    })

    must_have, _ = RequirementMatcher().match(normalize_request(request))

    assert must_have[0].matched is True
    assert must_have[0].evidence == "asp.net core"
