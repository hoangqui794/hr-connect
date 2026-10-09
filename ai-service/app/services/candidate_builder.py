from app.schemas.cv import CvParseResponse
from app.schemas.matching_request import Candidate, CandidateSkill, EducationEntry, WorkRole
from app.services.parse_diagnostics import unreliable_evidence_fields


def _blank_to_none(value: str | None) -> str | None:
    return value if value and value.strip() else None


def _role_text(role) -> str | None:
    parts = [role.description or "", ", ".join(role.technologies)]
    for project in role.projects:
        parts += [project.name, project.description or "", ", ".join(project.technologies)]
    return _blank_to_none("\n".join(part for part in parts if part and part.strip())[:20_000])


def candidate_from_parse(parse_result: CvParseResponse) -> Candidate:
    """Single mapping from a parsed CV to the matching input, for every entry point."""
    structured = parse_result.candidate
    return Candidate(
        summary=structured.summary or parse_result.raw_text[:5000],
        yearsOfExperience=structured.total_years_of_experience,
        highestEducation=(
            structured.education[0].degree or structured.education[0].school
            if structured.education
            else None
        ),
        skills=[
            CandidateSkill(name=skill.name, yearsOfExperience=skill.years_of_experience)
            for skill in structured.skills
        ],
        cvText=parse_result.raw_text,
        parseConfidence=parse_result.parse_confidence,
        requiresManualReview=parse_result.requires_manual_review,
        parseWarnings=parse_result.warnings,
        unreliableEvidenceFields=unreliable_evidence_fields(parse_result.diagnostics),
        workExperience=[
            WorkRole(
                position=_blank_to_none(role.position), company=_blank_to_none(role.company),
                startDate=_blank_to_none(role.start_date), endDate=_blank_to_none(role.end_date),
                text=_role_text(role),
            )
            for role in structured.work_experience[:50]
        ],
        education=[
            EducationEntry(
                degree=_blank_to_none(item.degree), major=_blank_to_none(item.major), school=_blank_to_none(item.school)
            )
            for item in structured.education[:20]
        ],
    )
