from app.schemas.cv import WorkExperience
from app.services.document_parser import DocumentBlock
from app.services.hybrid_cv_parser import (
    CompanyDateHeaderStrategy,
    ExperienceCandidate,
    ExperienceResolver,
    HybridExperienceParser,
    LayoutKind,
    SpatialDateRailStrategy,
    classify_layout,
)


def test_classifier_does_not_trust_missing_ocr_geometry() -> None:
    result = classify_layout(None, "UNSTRUCTURED", ocr_applied=True)

    assert result.kind is LayoutKind.OCR_UNPOSITIONED
    assert result.confidence < 0.6
    assert result.diagnostics == ("OCR_POSITION_DATA_UNAVAILABLE",)


def test_classifier_preserves_date_rail_as_timeline() -> None:
    blocks = [
        DocumentBlock("Company", page=1, bbox=(20, 100, 260, 112), column=1),
        DocumentBlock("2022 - Present", page=1, bbox=(380, 100, 560, 112), column=2),
        DocumentBlock("Engineer", page=1, bbox=(20, 116, 200, 128), column=1),
    ]

    result = classify_layout(blocks, "TIMELINE", ocr_applied=False)

    assert result.kind is LayoutKind.TIMELINE


def test_hybrid_strategies_extract_inline_timeline_and_company_date_header() -> None:
    lines = [
        "WORKING HISTORY",
        "2022 - now — Northwind Systems — Senior Full Stack Engineer",
        "WORKING EXPERIENCE",
        "Northwind Systems (2022 - now)",
        "Senior Full Stack Engineer",
    ]
    blocks = [DocumentBlock(text=line, page=1, bbox=(20, index * 20, 400, index * 20 + 12)) for index, line in enumerate(lines)]

    candidates, layout = HybridExperienceParser().extract(
        lines, blocks, "SINGLE_COLUMN", ocr_applied=False
    )

    assert layout.kind is LayoutKind.SINGLE_COLUMN
    assert {(item.company, item.position) for item in candidates} == {
        ("Northwind Systems", "Senior Full Stack Engineer")
    }
    assert {item.strategy for item in candidates} == {"inline_timeline", "company_date_header"}


def test_resolver_deduplicates_agreeing_evidence_and_rejects_conflicts() -> None:
    agreeing = ExperienceCandidate(
        company="Northwind Systems",
        position="Senior Engineer",
        start_date="2022",
        end_date="now",
        evidence=("2022 - now — Northwind Systems — Senior Engineer",),
        strategy="inline_timeline",
        confidence=0.9,
    )
    sequential = WorkExperience(
        company="Northwind Systems",
        position="Senior Engineer",
        startDate="2022",
        endDate="now",
        evidence="Northwind Systems (2022 - now) | Senior Engineer",
        confidence=0.9,
        sourceSection="experience",
    )
    resolution = ExperienceResolver.resolve([sequential], [agreeing])

    assert len(resolution.records) == 1
    assert resolution.warnings == []

    conflicting = agreeing.__class__(
        company="Northwind Systems",
        position="Product Manager",
        start_date="2022",
        end_date="now",
        evidence=("Northwind Systems (2022 - now) | Product Manager",),
        strategy="company_date_header",
        confidence=0.9,
    )
    conflict = ExperienceResolver.resolve([sequential], [conflicting])

    assert conflict.records == []
    assert conflict.warnings == ["EXPERIENCE_EVIDENCE_CONFLICT"]


def test_resolver_rejects_nonlocal_date_evidence_from_interleaved_pdf_text() -> None:
    interleaved = WorkExperience(
        company="Northwind Systems (2022)",
        position="Software Engineer",
        startDate="2018",
        endDate="2021",
        evidence="Northwind Systems (2022) | Software Engineer | Harbor Labs (2021 - 2022) | Legacy Works (2018 - 2021)",
        confidence=0.9,
        sourceSection="experience",
    )

    resolution = ExperienceResolver.resolve([interleaved], [])

    assert resolution.records == []


def test_company_header_strategy_keeps_project_and_employer_tech_in_its_own_company() -> None:
    """A single-year company header must end the previous company's projects."""
    lines = [
        "Storyx AG (2022 - now)",
        "Senior Full Stack Engineer",
        "1. Faktoora",
        "Tech stack: Fastify, Prisma, PostgreSQL, RabbitMQ, Next.js, Redux Toolkit",
        "Menuzen (2022)",
        "Full Stack Engineer",
        "Tech stack: Express, Knex, Apollo GraphQL, React, Material UI, dnd",
        "kit",
        "VNEXT Global (2021 - 2022)",
        "Node.js Leader",
        "Tech stack: PostgreSQL, NestJS, React, Zustand, react-hook-form, React Query, i18next",
    ]

    candidates = CompanyDateHeaderStrategy().extract(lines)

    storyx, menuzen, vnext = candidates
    assert storyx.projects[0].name == "Faktoora"
    assert storyx.projects[0].technologies == [
        "Fastify", "Prisma", "PostgreSQL", "RabbitMQ", "Next.js", "Redux Toolkit"
    ]
    assert menuzen.projects == ()
    assert menuzen.technologies == (
        "Express", "Knex", "Apollo GraphQL", "React", "Material UI", "dnd kit"
    )
    assert vnext.technologies == (
        "PostgreSQL", "NestJS", "React", "Zustand", "react-hook-form", "React Query", "i18next"
    )


def test_hybrid_strategy_extracts_company_location_role_and_month_dates_from_pipe_rows() -> None:
    lines = [
        "Northwind Interactive | City, VN Unity Developer | June 2023 - Present",
        "Harbor Automation | City, VN Volunteer Intern | October 2022 - May 2023",
    ]

    candidates, _ = HybridExperienceParser().extract(
        lines, blocks=None, declared_layout="SINGLE_COLUMN", ocr_applied=False
    )

    assert {(item.company, item.position, item.start_date, item.end_date) for item in candidates} == {
        ("Northwind Interactive", "Unity Developer", "June 2023", "Present"),
        ("Harbor Automation", "Volunteer Intern", "October 2022", "May 2023"),
    }


def test_spatial_date_rail_recovers_company_role_date_without_template_specific_rules() -> None:
    blocks = [
        DocumentBlock("Northwind Health | Marketing Center", page=1, bbox=(20, 100, 270, 112), column=1),
        DocumentBlock("June 2023 - early May 2026", page=1, bbox=(380, 100, 560, 112), column=2),
        DocumentBlock("Marketing Planner", page=1, bbox=(20, 116, 200, 128), column=1),
    ]

    candidates = SpatialDateRailStrategy().extract(blocks)

    assert [(item.company, item.position, item.start_date, item.end_date) for item in candidates] == [
        ("Northwind Health | Marketing Center", "Marketing Planner", "June 2023", "early May 2026")
    ]
