from app.services.structured_cv_parser import StructuredCvParser


def test_parses_bilingual_sections_and_contact_details() -> None:
    text = """NGUYEN VAN AN
an.nguyen@example.com | 0901 234 567
Tóm tắt
Backend developer xây dựng hệ thống tuyển dụng.
Kỹ năng
ASP.NET Core, PostgreSQL, Docker
Kinh nghiệm làm việc
Backend Developer - ACME | 01/2020 - 12/2022
Senior Developer - Beta | 06/2022 - 12/2024
Học vấn
Kỹ sư phần mềm - Đại học ABC | 2015 - 2019
Chứng chỉ
AWS Certified Developer
Ngôn ngữ
English: Intermediate
"""

    candidate = StructuredCvParser().parse(text, ["ASP.NET Core", "Redis"])

    assert candidate.full_name == "NGUYEN VAN AN"
    assert candidate.email == "an.nguyen@example.com"
    assert candidate.phone == "0901234567"
    assert candidate.summary == "Backend developer xây dựng hệ thống tuyển dụng."
    assert {skill.name for skill in candidate.skills} >= {"asp.net core", "postgresql", "docker"}
    assert "redis" not in {skill.name for skill in candidate.skills}
    assert candidate.total_years_of_experience == 5.0
    assert len(candidate.work_experience) == 2
    assert candidate.education
    assert candidate.certifications[0].name == "AWS Certified Developer"
    assert candidate.languages[0].name == "English"


def test_missing_dates_do_not_invent_experience_years() -> None:
    candidate = StructuredCvParser().parse("""TRAN THI BINH
Kinh nghiệm
Backend developer tại ACME
""")

    assert candidate.total_years_of_experience is None
    assert candidate.work_experience == []


def test_negated_skill_is_not_extracted() -> None:
    candidate = StructuredCvParser().parse(
        "NGUYEN VAN C\nKỹ năng\nPython, without Redis",
        ["Redis"],
    )

    assert "redis" not in {skill.name for skill in candidate.skills}


def test_rejects_heading_sentence_as_name_and_finds_language_globally() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """CAREER OBJECTIVE
CAREER OBJECTIVE A final-year Software Engineering student
NGUYEN VAN AN
EDUCATION
Example University (2023 - Present)
Major: Software Engineering
English: B2 Level
CERTIFICATE
Cloud Developer -
Example Academy (Coursera)
TECHNICAL SKILLS
C#, ASP.NET Core, PostgreSQL, Docker
WORK EXPERIENCE
Example Company | Backend Developer Intern Sep
2025 - Dec 2025
"""
    )

    assert result.candidate.full_name == "NGUYEN VAN AN"
    assert result.candidate.languages[0].name == "English"
    assert result.candidate.languages[0].level == "B2"
    assert result.candidate.total_years_of_experience == 0.3
    assert result.candidate.education[0].major == "Software Engineering"
    assert len(result.candidate.certifications) == 1
    assert "Cloud Developer" in result.candidate.certifications[0].name
    assert result.candidate.certifications[0].issuer == "Example Academy (Coursera)"
    assert {skill.name for skill in result.candidate.skills} >= {
        "c#", "asp.net core", "postgresql", "docker"
    }
    assert all("gpa" not in skill.name for skill in result.candidate.skills)


def test_low_confidence_parse_requests_manual_review_without_inventing_name() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        "CAREER OBJECTIVE\nExperienced developer building modern systems."
    )

    assert result.candidate.full_name is None
    assert result.requires_manual_review is True
    assert "FULL_NAME_LOW_CONFIDENCE" in result.warnings
    assert 0 <= result.confidence < 0.6
