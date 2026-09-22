import re
import unicodedata

from app.schemas.matching_request import CandidateSkill, JobRequirement, MatchingRequest


_WHITESPACE = re.compile(r"\s+")
_SKILL_ALIASES = {
    "asp net core": "asp.net core",
    "asp.net core": "asp.net core",
    "aspnet core": "asp.net core",
    "c sharp": "c#",
    "csharp": "c#",
    "postgres": "postgresql",
    "postgre sql": "postgresql",
}


def normalize_text(value: str, *, lowercase: bool = False) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    normalized = _WHITESPACE.sub(" ", normalized).strip()
    return normalized.casefold() if lowercase else normalized


def normalize_skill_name(value: str) -> str:
    normalized = normalize_text(value, lowercase=True)
    lookup_key = re.sub(r"[^\w#+]+", " ", normalized, flags=re.UNICODE).strip()
    return _SKILL_ALIASES.get(lookup_key, normalized)


def normalize_request(request: MatchingRequest) -> MatchingRequest:
    seen: dict[str, CandidateSkill] = {}
    for skill in request.candidate.skills:
        name = normalize_skill_name(skill.name)
        current = seen.get(name)
        if current is None or (skill.years_of_experience or 0) > (current.years_of_experience or 0):
            seen[name] = CandidateSkill(name=name, yearsOfExperience=skill.years_of_experience)

    candidate = request.candidate.model_copy(
        update={
            "summary": normalize_text(request.candidate.summary),
            "highest_education": (
                normalize_text(request.candidate.highest_education)
                if request.candidate.highest_education
                else None
            ),
            "skills": list(seen.values()),
            "cv_text": normalize_text(request.candidate.cv_text),
        }
    )
    requirements = [
        JobRequirement(
            type=item.type,
            category=item.category,
            content=(normalize_skill_name(item.content) if item.category.value == "SKILL" else normalize_text(item.content)),
        )
        for item in request.job.requirements
    ]
    job = request.job.model_copy(
        update={
            "title": normalize_text(request.job.title),
            "description": normalize_text(request.job.description),
            "requirements": requirements,
        }
    )
    return request.model_copy(update={"candidate": candidate, "job": job})
