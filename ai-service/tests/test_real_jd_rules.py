from datetime import date

from app.schemas.matching_request import Candidate, MatchingRequest, WorkRole
from app.services.normalizer import normalize_request
from app.services.requirement_matcher import RequirementMatcher
from app.services.requirement_rules import (
    contains,
    domain_terms,
    domain_years,
    education_matches,
    is_core_requirement,
)
from app.services.score_calculator import ScoreCalculator


def _match(requirements: list[dict], cv_text: str = "Software engineer.", title: str = "Developer",
           description: str = "Build software.", **candidate: object):
    request = MatchingRequest.model_validate({
        "requestId": "r", "applicationId": "a", "attemptNo": 1,
        "candidate": {"summary": "Engineer", "cvText": cv_text, **candidate},
        "job": {"title": title, "description": description, "requirements": requirements},
    })
    return RequirementMatcher().match(normalize_request(request))


def test_versions_and_plurals_match_the_base_term() -> None:
    assert contains("Languages: HTML5, CSS3/SCSS", "HTML")
    assert contains("Languages: HTML5, CSS3/SCSS", "CSS")
    assert contains("Implemented Stored Procedures for speed", "stored procedure")
    assert not contains("JavaScript and TypeScript", "Java")


def test_vietnamese_degree_requirement_accepts_english_it_degree() -> None:
    requirement = "Tốt nghiệp Cao đẳng/Đại học chuyên ngành Công nghệ Thông tin hoặc các ngành liên quan"
    it_grad = Candidate.model_validate({
        "summary": "x", "cvText": "x", "education": [{"degree": "Bachelor of Software Engineering"}],
    })
    mechatronics = Candidate.model_validate({
        "summary": "x", "cvText": "x",
        "education": [{"degree": "Bachelor of Engineering", "major": "Robotics and Mechatronics Engineering"}],
    })

    assert education_matches(requirement, it_grad, "") is True
    assert education_matches(requirement, mechatronics, "") is False
    assert education_matches("Good attitude", it_grad, "") is None


def test_domain_years_count_relevant_roles_only_and_skip_internships() -> None:
    roles = [
        WorkRole(position="Unity Developer", startDate="June 2023", endDate="Present", text="Gameplay in C# for Unity"),
        WorkRole(position="Backend Intern", startDate="01/2022", endDate="05/2023", text="ASP.NET Web API"),
        WorkRole(position="Software Engineer", startDate="2019", endDate="2021", text="ASP.NET Core and SQL Server"),
        WorkRole(position="Software Engineer", startDate="2020", endDate="2022", text=".NET 6 services"),
    ]

    result = domain_years(roles, [".NET"], today=date(2026, 10, 1))

    # 2019-01..2021-12 and 2020-01..2022-12 merge to 48 months; the internship and the
    # Unity/C# role (C# alone is not .NET platform experience) are excluded.
    assert result.years == 4.0
    assert result.roles == ["Software Engineer", "Software Engineer"]


def test_domain_years_ignore_unrelated_roles() -> None:
    roles = [WorkRole(position="Senior Full Stack Engineer", startDate="2018", endDate="now", text="Node.js, React")]

    assert domain_years(roles, ["Java"], today=date(2026, 10, 1)).years == 0


def test_experience_requirement_uses_domain_years_when_history_is_available() -> None:
    must, _ = _match(
        [{"type": "MUST_HAVE", "category": "EXPERIENCE", "content": "4+ years of experience in Java software development", "minYears": 4}],
        yearsOfExperience=8.8,
        workExperience=[{"position": "Full Stack Engineer", "startDate": "2018", "endDate": "now", "text": "Node.js, React"}],
    )

    assert domain_terms_for_java() == ["Java"]
    assert must[0].match_status == "NOT_FOUND"


def domain_terms_for_java() -> list[str]:
    from app.schemas.matching_request import JobRequirement

    return domain_terms(JobRequirement.model_validate(
        {"type": "MUST_HAVE", "category": "EXPERIENCE", "content": "4+ years of experience in Java software development"}
    ))


def test_experience_without_history_falls_back_with_warning() -> None:
    must, _ = _match(
        [{"type": "MUST_HAVE", "category": "EXPERIENCE", "content": "2 năm kinh nghiệm .NET", "minYears": 2}],
        yearsOfExperience=5,
    )

    assert must[0].match_status == "MATCHED"
    assert "DOMAIN_YEARS_UNVERIFIED" in must[0].warnings


def test_skill_synonyms_from_lexicon() -> None:
    must, _ = _match(
        [{"type": "MUST_HAVE", "category": "SKILL", "content": "Git and SQL", "operator": "ALL_OF", "alternatives": ["Git", "SQL"]}],
        cv_text="Tech stack: GitLab CI, PostgreSQL, Docker",
    )

    assert must[0].match_status == "MATCHED"


def test_requirement_named_in_job_title_is_core_and_caps_when_missing() -> None:
    must, should = _match(
        [
            {"type": "MUST_HAVE", "category": "SKILL", "content": "ASP.NET Core", "alternatives": ["ASP.NET Core"]},
            {"type": "MUST_HAVE", "category": "SKILL", "content": "HTML", "alternatives": ["HTML"]},
        ],
        cv_text="Tech stack: HTML5, React, Node.js",
        title="Lập Trình Viên (.NET)",
        description="Phát triển hệ thống trên nền tảng ASP.NET Core.",
    )

    assert must[0].core is True and must[1].core is False
    assert "CORE_REQUIREMENT_MISSING" in must[0].warnings
    assert ScoreCalculator().calculate(must, should, 1.0) <= 59


def test_core_requirement_detection_uses_job_text() -> None:
    from app.schemas.matching_request import JobRequirement

    spring = JobRequirement.model_validate(
        {"type": "MUST_HAVE", "category": "SKILL", "content": "Spring Boot", "alternatives": ["Spring Boot", "JPA"]}
    )
    angular = JobRequirement.model_validate(
        {"type": "MUST_HAVE", "category": "SKILL", "content": "Angular", "alternatives": ["Angular"]}
    )

    assert is_core_requirement(spring, "Java Backend Developer (Java 17+, Spring Boot)")
    assert not is_core_requirement(angular, "Java Backend Developer (Java 17+, Spring Boot)")
