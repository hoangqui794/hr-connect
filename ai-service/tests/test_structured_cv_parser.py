from app.services.document_parser import DocumentBlock
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
        """ANON CANDIDATE
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


def test_parser_resolves_summary_timeline_with_detailed_company_date_evidence() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """ANON CANDIDATE
WORKING HISTORY
2022 - now — Northwind Systems — Senior Full Stack Engineer
2021 - 2022 — Harbor Labs — Full Stack Engineer
WORKING EXPERIENCE
Northwind Systems (2022 - now)
Senior Full Stack Engineer
Harbor Labs (2021 - 2022)
Full Stack Engineer
"""
    )

    experience = {(item.company, item.position): item for item in result.candidate.work_experience}
    assert set(experience) == {
        ("Northwind Systems", "Senior Full Stack Engineer"),
        ("Harbor Labs", "Full Stack Engineer"),
    }
    assert result.warnings == []
    # Experience evidence is sufficient, but this synthetic CV deliberately
    # lacks contact/skills and therefore remains low-confidence overall.
    assert result.requires_manual_review is True


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


def test_parser_recovers_profile_education_detail_and_numbered_work_projects() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """ANON CANDIDATE
Software Engineer
An engineer focused on building reliable products for users and improving development workflows across teams.
email@example.com
TECHNICAL SKILLS
Python, Docker
EDUCATION
2014-2018 — Northwind University Engineer's Degree in Software Engineering Awarded a scholarship.
WORK EXPERIENCE
    Northwind Labs (2022 - now)
    Software Engineer
    1. Product Atlas
    Built services for enterprise users.
    Responsibilities:
2. Project Beacon
"""
    )

    education = result.candidate.education[0]
    assert result.candidate.summary is not None
    assert "reliable products" in result.candidate.summary
    assert education.school == "Northwind University"
    assert education.degree == "Engineer's Degree"
    assert education.major == "Software Engineering"
    assert [project.name for project in result.candidate.work_experience[0].projects] == [
        "Product Atlas",
        "Project Beacon",
    ]
    assert result.candidate.work_experience[0].projects[0].description == "Built services for enterprise users."


def test_parser_normalizes_modern_web_and_devops_skills() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """ANON CANDIDATE
SKILLS
Express, Fastify, GraphQL, tRPC, Drizzle ORM, Sentry, Elasticsearch, OpenSearch,
Redux Toolkit, React Query, React Hook Form, Tailwind, shadcn, styled-components,
i18next, Vite, Remix, Astro, Vercel, Fly.io, GitHub Workflows, NX, Linux, Rust.
"""
    )

    skills = {item.name.casefold() for item in result.candidate.skills}
    assert {
        "express", "fastify", "graphql", "trpc", "drizzle", "sentry", "elasticsearch", "opensearch",
        "redux toolkit", "react query", "react hook form", "tailwind css", "shadcn", "styled-components",
        "i18next", "vite", "remix", "astro", "vercel", "fly.io", "github actions", "nx", "linux", "rust",
    } <= skills


def test_parser_handles_indented_unity_cv_sections_without_summary_leakage() -> None:
    raw_text = """ANON CANDIDATE
PROFESSIONAL SUMMARY
2+ years Unity Developer building AR and mobile games.
EDUCATION
Bachelor of Engineering (Robotics and Mechatronics Engineering) (Honors) Northshore University Vietnam
Bachelor of Science in Aerospace Engineering (Transfer) Orchard University, USA
Associate in Engineering Riverside Community College, USA
TECHNICAL SKILLS
Game Engines: Unity Editor (Expert), Unreal Engine.
Programming: C# (Expert), Python, JavaScript, MATLAB, Arduino.
Specialized Frameworks: AR Foundation, Cesium (Geospatial), Unity Assets.
Software & Tools: Visual Studio, GitHub, RobotStudio, SolidWorks, OpenCV.
PROFESSIONAL EXPERIENCE
Northwind Interactive | City, VN Unity Developer | June 2023 - Present
Harbor Automation | City, VN Volunteer Intern | October 2022 - May 2023
PROJECT PORTFOLIO
Puzzle Atlas: Implemented a mobile puzzle game.
Ocean Quest: Developed AR mechanics using AR Foundation.
Personal Project | Fullstack Web Project: MapWorks (3D Digital Twin) - Map Link
"""

    result = StructuredCvParser().parse_with_diagnostics(raw_text, layout="SINGLE_COLUMN")
    candidate = result.candidate

    assert candidate.summary == "2+ years Unity Developer building AR and mobile games."
    assert [item.school for item in candidate.education] == [
        "Northshore University Vietnam", "Orchard University, USA", "Riverside Community College, USA"
    ]
    assert {skill.name for skill in candidate.skills} >= {
        "unity editor", "unreal engine", "c#", "python", "javascript", "matlab", "arduino",
        "ar foundation", "cesium", "visual studio", "github", "robotstudio", "solidworks", "opencv",
    }
    assert "communication" not in {skill.name for skill in candidate.skills}
    assert {(item.company, item.position) for item in candidate.work_experience} == {
        ("Northwind Interactive", "Unity Developer"), ("Harbor Automation", "Volunteer Intern")
    }
    projects = {item.name: item for item in candidate.side_projects}
    assert projects["Ocean Quest"].technologies == ["ar foundation"]
    assert "MapWorks (3D Digital Twin)" in projects
    assert "communication" not in projects["MapWorks (3D Digital Twin)"].technologies


def test_parser_recovers_header_summary_from_visual_blocks() -> None:
    raw_text = """ANON CANDIDATE
Driven marketer seeking for opportunities in Brand and
Product Marketing
email@example.com
EDUCATION
Northwind University
2016 - 2020
Bachelor of International Business
"""
    blocks = [
        DocumentBlock(text="ANON CANDIDATE", page=1, bbox=(60, 30, 260, 45)),
        DocumentBlock(
            text="Driven marketer seeking for opportunities in Brand and",
            page=1,
            bbox=(320, 30, 600, 45),
        ),
        DocumentBlock(text="Product Marketing", page=1, bbox=(320, 48, 470, 62)),
        DocumentBlock(text="EDUCATION", page=1, bbox=(320, 120, 410, 135)),
    ]

    result = StructuredCvParser().parse_with_diagnostics(raw_text, blocks=blocks)

    assert result.candidate.summary == "Driven marketer seeking for opportunities in Brand and Product Marketing"


def test_parser_structures_compound_headings_and_nested_skill_lists() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """ANON CANDIDATE
EDUCATION
Northwind University
2016 - 2020
Bachelor of International Business
HONORS AND AWARDS
Excellent employee of the year — Northwind Group
2024
Promising employee — Northwind Group
2023
CERTIFICATES & SHORT COURSES
Brand Leadership Foundation, Hands Collective
Marketing Thinking, Northwind Institute
Brandcamp, Northwind Lab
TOEIC (2017), ETS
SKILLS
Core Competencies: Market Research Design, Brand Management, Adaptability.
Tools & Softwares: Office tools, CRM, AI Tools (ChatGPT, Gemini, Google Studio,
NotebookLM ...).
Languages: English, Vietnamese.
"""
    )

    education = result.candidate.education
    skills = {item.name.casefold() for item in result.candidate.skills}

    assert len(education) == 1
    assert education[0].school == "Northwind University"
    assert education[0].degree == "Bachelor of International Business"
    assert [item.name for item in result.candidate.certifications] == [
        "Brand Leadership Foundation, Hands Collective",
        "Marketing Thinking, Northwind Institute",
        "Brandcamp, Northwind Lab",
        "TOEIC (2017), ETS",
    ]
    assert result.candidate.awards == [
        "2024 — Excellent employee of the year — Northwind Group",
        "2023 — Promising employee — Northwind Group",
    ]
    assert {"market research design", "brand management", "adaptability", "office tools", "crm", "chatgpt", "gemini", "google studio", "notebooklm"} <= skills
    assert "english" not in skills
    assert "vietnamese" not in skills
    assert all("AI Tools (ChatGPT" not in item.name for item in result.candidate.skills)


def test_parser_preserves_project_led_experience_without_inventing_an_employer() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """ANON CANDIDATE
WORK EXPERIENCE
[04/2025 - 06/2025]
Project: Harbor Booking Platform
Role: Frontend Developer
Built reusable interfaces using React and TypeScript.
[07/2025 - 09/2025]
Project: Atlas Labeling System
Role: Frontend Developer
Implemented responsive workflows.
EDUCATION
University of Transport and Communication
"""
    )

    experience = result.candidate.work_experience

    assert [(item.company, item.position, item.start_date, item.end_date) for item in experience] == [
        (None, "Frontend Developer", "04/2025", "06/2025"),
        (None, "Frontend Developer", "07/2025", "09/2025"),
    ]
    assert [item.projects[0].name for item in experience] == [
        "Harbor Booking Platform", "Atlas Labeling System",
    ]
    assert result.candidate.total_years_of_experience == 0.5
    assert result.candidate.education[0].school == "University of Transport and Communication"
    assert "EMPLOYER_NOT_STATED" in result.warnings
    assert result.requires_manual_review is True


def test_parser_prefers_name_value_beside_a_name_label() -> None:
    blocks = [
        DocumentBlock(text="PERSONAL DETAILS", page=1, bbox=(40, 40, 250, 62), font_size=18, is_bold=True),
        DocumentBlock(text="Name:", page=1, bbox=(40, 80, 100, 95), font_size=11),
        DocumentBlock(text="Alex Morgan", page=1, bbox=(145, 80, 260, 95), font_size=11, is_bold=True),
    ]

    result = StructuredCvParser().parse_with_diagnostics(
        "PERSONAL DETAILS\nName:\nAlex Morgan\n",
        blocks=blocks,
    )

    assert result.candidate.full_name == "Alex Morgan"


def test_parser_keeps_project_headers_and_attaches_bullet_descriptions() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """ANON CANDIDATE
PERSONAL PROJECTS
Northwind Marketplace - E-commerce platform
Built responsive React interfaces.
Link product: https://example.test/northwind
Harbor Analytics - Reporting platform
Implemented a dashboard using TypeScript.
Other Projects (Atlas, Beacon)
React.js and Next.js
"""
    )

    assert [(item.name, item.description) for item in result.candidate.side_projects] == [
        (
            "Northwind Marketplace",
            "E-commerce platform Built responsive React interfaces. Link product: https://example.test/northwind",
        ),
        ("Harbor Analytics", "Reporting platform Implemented a dashboard using TypeScript."),
    ]


def test_parser_stops_summary_at_an_unrouted_achievements_heading() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """ANON CANDIDATE
SUMMARY
Backend engineer who builds dependable services.
KEY ACHIEVEMENTS
Delivered six production integrations and reduced latency.
SKILLS
Python
"""
    )

    assert result.candidate.summary == "Backend engineer who builds dependable services."
    assert "Delivered six" not in result.candidate.summary


def test_parser_normalizes_bullets_and_skill_spelling_without_collapsing_redux_tools() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """ANON CANDIDATE
SKILLS
 React.js, react, Redux Toolkit, Redux Saga
"""
    )

    skills = {item.name for item in result.candidate.skills}
    assert "" not in skills
    assert skills == {"react", "redux toolkit", "redux saga"}


def test_parser_attaches_a_standalone_date_to_the_immediately_following_project() -> None:
    result = StructuredCvParser().parse_with_diagnostics(
        """ANON CANDIDATE
PERSONAL PROJECTS
03/2026 – Now
Project: Booking System Backend
Built idempotent booking workflows using NestJS.
"""
    )

    project = result.candidate.side_projects[0]
    assert (project.name, project.start_date, project.end_date) == (
        "Booking System Backend", "03/2026", "Now"
    )
