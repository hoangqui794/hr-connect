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


def test_document_title_and_role_are_not_selected_as_candidate_name() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        "CURRICULUM VITAE\nARCHITECT\nTRUONG HOANG TRIEU\n"
        "Academic\nArchitecture University\n"
        "Professional Activities\nPSS Vietnam | Architect | 2024 - Present\n"
        "Skills\nRevit, AutoCAD, Photoshop\n"
        "Languages\nEnglish: Advanced"
    )

    assert result.candidate.full_name == "TRUONG HOANG TRIEU"
    assert result.candidate.education
    assert result.candidate.work_experience
    assert {skill.name for skill in result.candidate.skills} >= {
        "revit", "autocad", "photoshop"
    }
    assert result.candidate.languages[0].level == "ADVANCED"


def test_ocr_without_position_data_requests_manual_review() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        "RESUME\nExperienced designer", layout="UNSTRUCTURED", ocr_applied=True
    )

    assert result.requires_manual_review is True
    assert "OCR_LAYOUT_UNSTRUCTURED" in result.warnings
    assert "OCR_POSITION_DATA_UNAVAILABLE" in result.warnings


def test_parser_recognizes_common_abbreviated_section_headings() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """Nguyen Van A
EDU
University of Technology
2019 - 2023
EXP.
ACME | Backend Developer 2022 - 2024
TECH SKILLS
Python, Docker
CERT.
AWS Cloud Practitioner
LANG.
English - Advanced
PROJ.
Hiring platform
"""
    )

    assert len(result.candidate.education) >= 1
    assert len(result.candidate.work_experience) == 1
    assert {skill.name for skill in result.candidate.skills} >= {"python", "docker"}
    assert len(result.candidate.certifications) == 1
    assert result.candidate.languages[0].name == "English"


def test_parser_preserves_supplementary_cv_sections() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """Nguyen Van A
AWARDS & ACHIEVEMENTS
Top 5 campaign 2022
ACTIVITIES
Volunteer mentor
INTERESTS
Reading and photography
REFERENCES
Available upon request
"""
    )

    assert result.candidate.awards == ["Top 5 campaign 2022"]
    assert result.candidate.activities == ["Volunteer mentor"]
    assert result.candidate.interests == ["Reading and photography"]
    assert result.candidate.references == ["Available upon request"]


def test_parser_extracts_skill_years_from_inline_cv_format() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """Pham Thi Ngoc Tuyet
SKILL
Back-end: CSS (10+ years), ReactJS (2 years), Java (1 year)
Soft skills: Problem solving
"""
    )

    skills = {item.name: item.years_of_experience for item in result.candidate.skills}
    assert skills["react"] == 2
    assert skills["java"] == 1


def test_parser_keeps_self_reported_skill_score_separate_from_experience() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """Nguyen Van A
SKILLS
Communication ★★★★☆
Microsoft Excel 85%
"""
    )

    skills = {item.name: item for item in result.candidate.skills}
    assert skills["communication"].self_reported_score == 80
    assert skills["microsoft excel"].self_reported_score == 85


def test_parser_extracts_technical_stack_and_project_evidence() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """Nguyen Van A
SKILLS
Backend: ASP.NET Core, .NET, NestJS, Node.js, REST API
Frontend: React.js, React Native, HTML, CSS
Databases: SQL Server, PostgreSQL, MongoDB, EF Core, Prisma
Tools: Docker, Redis, RabbitMQ, AWS, CI/CD
PROJECTS
Cinema Booking (Personal project) - ASP.NET Core, React Native
Tech Stack: ASP.NET Core, C#, EF Core, Redis, Docker
"""
    )

    skill_names = {item.name for item in result.candidate.skills}
    assert {"nestjs", "node.js", "react", "react native", "prisma", "rabbitmq", "ci/cd"} <= skill_names
    assert result.candidate.projects[0].startswith("Cinema Booking")


def test_parser_handles_enterprise_cv_sections_and_project_lines() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """DUONG THIEN KHOI
PROFESSIONAL SUMMARY
Software Engineer with enterprise experience.
CORE TECHNICAL SKILLS
Backend: .NET Core, ASP.NET Core, Angular, Kafka, AWS Lambda, xUnit
WORK EXPERIENCE
Ambition Plus
Project: SmartHub & Eclipse Aura - Australian Car Dealership Management | Jan 2026 - Present
NOTABLE SIDE PROJECTS
RealtimeDashboard - Distributed system demo using Kafka
EDUCATION
Bachelor of Software Engineering
"""
    )

    names = {item.name for item in result.candidate.skills}
    assert {"angular", "kafka", "aws lambda", "xunit"} <= names
    assert any(item.startswith("Project: SmartHub") for item in result.candidate.projects)
    assert any(item.startswith("RealtimeDashboard") for item in result.candidate.projects)


def test_parser_nests_company_projects_without_counting_project_dates_as_jobs() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """NGUYEN VAN A
WORK EXPERIENCE
Ambition Plus
Software Engineer II
Jan 2024 - Dec 2024
Project: SmartHub - Dealership platform | Jan 2024 - Present
Technologies: .NET, Angular, Kafka
CMC Global
Software Engineer II
Sep 2022 - Dec 2023
Project: NTT Data Web Platform | Mar 2023 - Sep 2023
NOTABLE SIDE PROJECTS
Jira Worklog Reporter - Node.js automation tool
RealtimeDashboard - Distributed system demo using Kafka
"""
    )

    experience = result.candidate.work_experience
    assert [item.company for item in experience] == ["Ambition Plus", "CMC Global"]
    assert experience[0].projects[0].name == "SmartHub - Dealership platform"
    assert experience[0].projects[0].technologies == [".NET", "Angular", "Kafka"]
    assert experience[1].projects[0].name == "NTT Data Web Platform"
    assert [item.name for item in result.candidate.side_projects] == [
        "Jira Worklog Reporter",
        "RealtimeDashboard",
    ]
    assert result.candidate.total_years_of_experience == 2.3


def test_parser_recovers_employer_dates_displaced_by_two_column_pdf_extraction() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """NGUYEN VAN A
WORK EXPERIENCE
CMC Global
Software Engineer II
TechPro Sdx JSC
Senior Fullstack Developer
Project: Enterprise Resource Planning | January 2024 - July 2024
Sep 2024 - Dec 2025
Project: Bosch ERP | Oct 2025 - Dec 2025
June 2022 - August 2024
Project: CMMS | June 2022 - May 2023
"""
    )

    experience = {item.company: item for item in result.candidate.work_experience}
    assert experience["CMC Global"].start_date == "Sep 2024"
    assert [project.name for project in experience["CMC Global"].projects] == ["Bosch ERP"]
    assert experience["TechPro Sdx JSC"].start_date == "June 2022"
    assert [project.name for project in experience["TechPro Sdx JSC"].projects] == [
        "Enterprise Resource Planning",
        "CMMS",
    ]


def test_parser_recognizes_plural_heading_and_non_technical_role_layouts() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """NGUYEN VAN A
WORK EXPERIENCES
Trade Intelligence Global Co Ltd
02/2022 - 08/2023
Sales Executive
Achievements
Exceeded quarterly sales target.
HR Officer
09/2023 - Present
CityCare Hospital
01/2020 - 01/2022
Logistics One
Operations Supervisor
HR Specialist // Mar 2018 - Jul 2019
People First Ltd
"""
    )

    experience = {(item.company, item.position): item for item in result.candidate.work_experience}
    assert ("Trade Intelligence Global Co Ltd", "Sales Executive") in experience
    assert ("CityCare Hospital", "HR Officer") in experience
    assert ("Logistics One", "Operations Supervisor") in experience
    assert ("People First Ltd", "HR Specialist") in experience
    assert result.warnings == []


def test_parser_flags_unresolved_experience_evidence_for_human_review() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """NGUYEN VAN A
WORK EXPERIENCE
Sales Executive
02/2022 - 08/2023
Managed enterprise customers and contracts.
"""
    )

    assert result.candidate.work_experience == []
    assert result.requires_manual_review is True
    assert "EXPERIENCE_EVIDENCE_UNRESOLVED" in result.warnings
