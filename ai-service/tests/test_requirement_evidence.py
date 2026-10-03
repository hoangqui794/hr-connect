import pytest
import numpy as np

from app.schemas.matching_request import MatchingRequest
from app.services.normalizer import normalize_request
from app.services.requirement_matcher import RequirementMatcher
from app.services.semantic_matcher import SemanticMatcher
from app.services.structured_cv_parser import StructuredCvParser


def evaluate(content, text):
    request = MatchingRequest.model_validate({
        "requestId": "anonymous", "applicationId": "anonymous", "attemptNo": 1,
        "candidate": {"summary": "Candidate profile", "cvText": text, "skills": []},
        "job": {"title": "Role", "description": "Role requirements", "requirements": [
            {"type": "MUST_HAVE", "category": "OTHER", "content": content}
        ]},
    })
    return RequirementMatcher().match(normalize_request(request))[0][0]


@pytest.mark.parametrize("content,text,status", [
    ("Build and standardize reusable frontend codebases", "Built complete source base architecture.\nDesigned reusable UI components using Angular.", "MATCHED"),
    ("Database design and query optimization", "Improved system performance by optimizing queries and indexing strategies.", "PARTIAL"),
    ("Database design and query optimization", "Implemented database designs by BA team.\nOptimized queries.", "PARTIAL"),
    ("Problem analysis, teamwork, and proactive technical solution proposals", "Collaborated with stakeholders on business workflows.", "PARTIAL"),
    ("Backend and client performance optimization", "Optimized database queries and indexing for higher throughput.", "PARTIAL"),
    ("Sales prospecting and negotiation", "Generated leads for regional accounts.", "PARTIAL"),
    ("Sales prospecting or negotiation", "Negotiated customer contracts.", "MATCHED"),
    ("Content creation and campaign analysis", "Created content for product launches.\nAnalyzed campaign results.", "MATCHED"),
    ("Tìm kiếm khách hàng và đàm phán", "Đàm phán hợp đồng với khách hàng.", "PARTIAL"),
    ("Database design", "Want to learn database design.", "NOT_FOUND"),
    ("Database design", "No database design experience.", "NOT_FOUND"),
])
def test_capability_evidence_across_industries(content, text, status):
    result = evaluate(content, text)
    assert result.match_status == status
    assert result.requires_manual_review  # inferred decomposition is disclosed
    for criterion in result.criteria:
        evidence = criterion["evidence"]
        if evidence:
            assert text[evidence["start"]:evidence["end"]] == evidence["text"]


def test_embedding_retrieval_never_claims_verification():
    class Model:
        def encode(self, sentences, **kwargs):
            return np.ones((len(sentences), 4))
    results = SemanticMatcher(Model()).retrieve_evidence(["Database design"], "Want to learn database design.")
    assert results[0][0]["verified"] is False
    assert evaluate("Database design", results[0][0]["text"]).matched is False


def test_unknown_conjunct_is_not_silently_discarded():
    result = evaluate("Negotiation and underwater welding", "Negotiated customer contracts.")
    assert result.match_status == "PARTIAL"
    assert any("welding" in value.lower() for value in result.missing_evidence)


def test_measured_performance_rejects_completion_percentage_and_prefers_capacity():
    result = evaluate(
        "Direct backend and client performance optimization with measurable improvement "
        "in response time, user experience, or system capacity",
        "Built 80% of core system modules.\n"
        "Engineered high throughput data processing pipelines handling 1M+ daily records "
        "using database partitioning and optimized indexing.",
    )

    criteria = {item["criterion"]: item for item in result.criteria}
    assert criteria["Backend performance"]["status"] == "MATCHED"
    assert criteria["Client performance"]["status"] == "NOT_FOUND"
    measured = criteria["Measured improvement"]
    assert measured["status"] == "MATCHED"
    assert "1M+ daily records" in measured["evidence"]["text"]
    assert "80%" not in measured["evidence"]["text"]
    assert "Unresolved AND/OR grouping" not in criteria
    assert result.match_status == "PARTIAL"
    assert result.evidence_coverage == pytest.approx(2 / 3)


def test_completion_percentage_alone_is_not_measured_performance_evidence():
    result = evaluate(
        "Backend performance optimization with measurable improvement",
        "Built 80% of core system modules.",
    )

    criteria = {item["criterion"]: item for item in result.criteria}
    assert criteria["Measured improvement"]["status"] == "NOT_FOUND"


def test_completion_percentage_near_technical_context_is_not_a_performance_metric():
    result = evaluate(
        "Backend performance optimization with measurable improvement",
        "Built 80% of core modules using optimized indexing strategies.",
    )

    criteria = {item["criterion"]: item for item in result.criteria}
    assert criteria["Measured improvement"]["status"] == "NOT_FOUND"


def test_simple_or_list_normalizes_and_matches_mentoring_evidence():
    result = evaluate(
        "Large-scale systems, unit testing, code review, or mentoring",
        "Mentored new team members through code reviews and engineering best practices.",
    )

    criteria = {item["criterion"]: item for item in result.criteria}
    assert result.match_status == "MATCHED"
    assert result.evidence_coverage == 1
    assert "Mentoring" in criteria
    assert criteria["Mentoring"]["status"] == "MATCHED"
    assert not any(item.lower().startswith("or ") for item in criteria)


def test_aspirational_mentoring_is_not_verified():
    result = evaluate(
        "Large-scale systems, unit testing, code review, or mentoring",
        "Seeking to mentor new team members in the future.",
    )

    assert result.match_status == "NOT_FOUND"


def test_plain_language_requirement_through_match_api(client):
    payload = {
        "requestId": "anonymous", "applicationId": "anonymous", "attemptNo": 1,
        "candidate": {"summary": "Engineer", "skills": [], "cvText": "Optimized queries and indexing."},
        "job": {"title": "Engineer", "description": "Build systems", "requirements": [
            {"type": "MUST_HAVE", "category": "OTHER", "content": "Database design and query optimization"}
        ]},
    }
    response = client.post("/api/v1/match", json=payload)
    assert response.status_code == 200
    result = response.json()["mustHaveResult"][0]
    assert result["matchStatus"] == "PARTIAL"
    assert result["criteria"][1]["evidence"]["source"] == "cvText"


def test_project_description_and_wrapped_stack_survive():
    text = """Alex Example
alex@example.invalid
WORK EXPERIENCE
Example Company
Jan 2022 – Present
Software Engineer
Project: Portal | Jan 2022 – Present
Built reusable UI components for customer workflows.
Technologies: Python, PostgreSQL,
Docker, Redis
Project: Analytics | Jan 2023 – Present
Implemented reporting for sales teams.
Technologies: Java
EDUCATION
Example University
2016 – 2020
Bachelor of Engineering
"""
    parsed = StructuredCvParser().parse_with_diagnostics(text)
    projects = parsed.candidate.work_experience[0].projects
    assert "reusable UI" in projects[0].description
    assert "Redis" in projects[0].technologies
    assert "Java" not in projects[0].technologies
    assert "reporting" in projects[1].description
    assert parsed.confidence < 1


def test_skill_group_headings_and_versions_are_not_extra_skills():
    text = """Alex Example
SKILLS
Cloud & DevOps
DevOps: Docker, Kubernetes
Databases & Architecture
Frontend: Angular 13–22 (Expert), React
"""
    names = [item.name for item in StructuredCvParser().parse(text).skills]
    assert "cloud & devops" not in names
    assert "databases & architecture" not in names
    assert names.count("angular") == 1
    assert not any("expert" in name for name in names)
