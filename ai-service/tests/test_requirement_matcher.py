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


def test_requirement_matcher_supports_any_of_skill_groups_and_minimum_years() -> None:
    request = MatchingRequest.model_validate({
        "requestId": "or-group-001",
        "applicationId": "application-001",
        "attemptNo": 1,
        "candidate": {
            "summary": "Fullstack developer",
            "yearsOfExperience": 4.3,
            "skills": [{"name": "Angular"}, {"name": "SQL Server"}],
            "cvText": "Built Angular applications with SQL Server.",
        },
        "job": {
            "title": "Senior Fullstack Developer",
            "description": "Build products",
            "requirements": [
                {
                    "type": "MUST_HAVE",
                    "category": "SKILL",
                    "content": "Angular, React, or Vue",
                    "operator": "ANY_OF",
                    "alternatives": ["Angular", "React", "Vue"],
                },
                {
                    "type": "MUST_HAVE",
                    "category": "SKILL",
                    "content": "SQL Server or MySQL",
                    "operator": "ANY_OF",
                    "alternatives": ["SQL Server", "MySQL"],
                },
                {
                    "type": "MUST_HAVE",
                    "category": "EXPERIENCE",
                    "content": "Web application experience",
                    "operator": "AT_LEAST",
                    "minYears": 3,
                },
            ],
        },
    })

    must_have, _ = RequirementMatcher().match(normalize_request(request))

    assert [item.matched for item in must_have] == [True, True, True]
    assert must_have[0].matched_terms == ["angular"]
    assert must_have[1].matched_terms == ["sql server"]
    assert must_have[2].evidence == "4.3 years of experience"


def test_requirement_matcher_requires_each_evidence_group_for_semantic_requirement() -> None:
    request = MatchingRequest.model_validate({
        "requestId": "evidence-group-001",
        "applicationId": "application-001",
        "attemptNo": 1,
        "candidate": {
            "summary": "Backend engineer",
            "skills": [],
            "cvText": "Optimized database queries and indexing for a throughput of one million daily records.",
        },
        "job": {
            "title": "Senior Fullstack Developer",
            "description": "Optimize performance",
            "requirements": [{
                "type": "MUST_HAVE",
                "category": "OTHER",
                "content": "Backend and client performance optimization",
                "evidenceGroups": [
                    ["performance optimization", "optimized queries", "indexing", "caching"],
                    ["response time", "throughput", "load time", "capacity"],
                ],
            }],
        },
    })

    must_have, _ = RequirementMatcher().match(normalize_request(request))

    # Indexing/throughput proves backend work only, not the client conjunct.
    assert must_have[0].matched is False
    assert must_have[0].match_status == "PARTIAL"
    assert "Client performance" in must_have[0].missing_evidence


def test_requirement_matcher_reports_partial_evidence_and_missing_groups() -> None:
    request = MatchingRequest.model_validate({
        "requestId": "partial-evidence-001",
        "applicationId": "application-001",
        "attemptNo": 1,
        "candidate": {
            "summary": "Fullstack engineer",
            "skills": [],
            "cvText": "Optimized queries and indexing for SQL Server.",
        },
        "job": {
            "title": "Senior Fullstack Developer",
            "description": "Build scalable applications",
            "requirements": [{
                "type": "MUST_HAVE",
                "category": "OTHER",
                "content": "Database design and query optimization",
                "evidenceGroups": [
                    ["database design", "data modeling", "database schema"],
                    ["query optimization", "optimizing queries", "optimized queries", "indexing"],
                ],
            }],
        },
    })

    must_have, _ = RequirementMatcher().match(normalize_request(request))

    result = must_have[0]
    assert result.matched is False
    assert result.match_status == "PARTIAL"
    assert result.evidence_coverage == 0.5
    assert result.matched_terms == ["optimized queries"]
    assert result.missing_evidence == ["evidence group 1: database design / data modeling / database schema"]


def test_requirement_matcher_marks_only_unreadable_relevant_evidence_unknown() -> None:
    payload = {
        "requestId": "unknown-evidence-001",
        "applicationId": "application-001",
        "attemptNo": 1,
        "candidate": {
            "summary": "Backend developer",
            "skills": [],
            "cvText": "Backend services",
            "parseConfidence": 0.55,
            "requiresManualReview": True,
            "parseWarnings": ["EXPERIENCE_EVIDENCE_UNRESOLVED"],
            "unreliableEvidenceFields": ["experience"],
        },
        "job": {
            "title": "Backend Developer",
            "description": "Build APIs",
            "requirements": [
                {
                    "type": "MUST_HAVE",
                    "category": "EXPERIENCE",
                    "content": "At least 3 years experience",
                    "minYears": 3,
                },
                {
                    "type": "MUST_HAVE",
                    "category": "SKILL",
                    "content": "Redis",
                },
            ],
        },
    }

    must_have, _ = RequirementMatcher().match(
        normalize_request(MatchingRequest.model_validate(payload))
    )

    assert must_have[0].match_status == "UNKNOWN"
    assert must_have[0].match_method == "UNKNOWN"
    assert must_have[0].evidence_coverage == 0
    assert must_have[0].requires_manual_review is True
    assert must_have[1].match_status == "NOT_FOUND"


def test_requirement_matcher_preserves_partial_when_parser_is_uncertain() -> None:
    payload = {
        "requestId": "partial-uncertain-001",
        "applicationId": "application-001",
        "attemptNo": 1,
        "candidate": {
            "summary": "Backend engineer",
            "skills": [],
            "cvText": "Optimized queries and indexing.",
            "requiresManualReview": True,
            "unreliableEvidenceFields": ["all"],
        },
        "job": {
            "title": "Engineer",
            "description": "Database work",
            "requirements": [{
                "type": "MUST_HAVE",
                "category": "OTHER",
                "content": "Database design and query optimization",
                "evidenceGroups": [
                    ["database design"],
                    ["optimized queries", "indexing"],
                ],
            }],
        },
    }

    must_have, _ = RequirementMatcher().match(
        normalize_request(MatchingRequest.model_validate(payload))
    )

    assert must_have[0].match_status == "PARTIAL"
    assert must_have[0].evidence_coverage == 0.5
