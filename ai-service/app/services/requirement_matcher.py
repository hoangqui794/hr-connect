import re

from app.schemas.matching_request import MatchingRequest, RequirementCategory, RequirementType
from app.schemas.matching_response import RequirementMatch
from app.services.normalizer import extract_skill_alias, normalize_skill_name, normalize_text


def _contains_phrase(text: str, phrase: str) -> bool:
    pattern = rf"(?<!\w){re.escape(phrase)}(?!\w)"
    negative_context = re.compile(
        r"(?:without|no|not|lacks?|missing|không\s+có|chưa\s+có|thiếu)\s+$",
        flags=re.IGNORECASE,
    )
    for match in re.finditer(pattern, text, flags=re.IGNORECASE):
        prefix = text[max(0, match.start() - 24) : match.start()]
        if negative_context.search(prefix):
            continue
        return True
    return False


def _required_years(content: str) -> float | None:
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:\+\s*)?(?:years?|yrs?|năm)", content, re.IGNORECASE)
    return float(match.group(1).replace(",", ".")) if match else None


def _education_matches(candidate_facts: str, requirement: str) -> bool:
    degree_terms = ("bachelor", "master", "phd", "engineer", "cử nhân", "thạc sĩ", "tiến sĩ", "kỹ sư")
    subject_terms = (
        "computer science", "information technology", "software engineering",
        "công nghệ thông tin", "kỹ thuật phần mềm", "khoa học máy tính",
    )
    required_degree = [term for term in degree_terms if term in requirement]
    required_subject = [term for term in subject_terms if term in requirement]
    if required_degree and not any(term in candidate_facts for term in required_degree):
        return False
    if required_subject and not any(term in candidate_facts for term in required_subject):
        return False
    return bool(required_degree or required_subject)


class RequirementMatcher:
    """Deterministic matching; semantic scores never flip rule results."""

    def match(self, request: MatchingRequest) -> tuple[list[RequirementMatch], list[RequirementMatch]]:
        skill_map = {normalize_skill_name(skill.name): skill for skill in request.candidate.skills}
        evidence_text = normalize_text(
            f"{request.candidate.summary} {request.candidate.cv_text}", lowercase=True
        )
        must_have: list[RequirementMatch] = []
        should_have: list[RequirementMatch] = []

        for requirement in request.job.requirements:
            content = normalize_text(requirement.content)
            lookup = normalize_skill_name(content)
            matched = False
            evidence: str | None = None

            if requirement.category == RequirementCategory.SKILL:
                canonical = extract_skill_alias(content) or lookup
                explicit = skill_map.get(canonical) or skill_map.get(lookup)
                if explicit is not None:
                    matched, evidence = True, explicit.name
                elif _contains_phrase(evidence_text, canonical):
                    matched, evidence = True, canonical
            elif requirement.category == RequirementCategory.EXPERIENCE:
                required_years = _required_years(content)
                candidate_years = request.candidate.years_of_experience
                if required_years is not None and candidate_years is not None and candidate_years >= required_years:
                    matched, evidence = True, f"{candidate_years:g} years of experience"
                elif required_years is None and _contains_phrase(evidence_text, normalize_text(content, lowercase=True)):
                    matched, evidence = True, content
            else:
                candidate_facts = normalize_text(
                    f"{request.candidate.summary} {request.candidate.highest_education or ''} "
                    f"{request.candidate.cv_text}",
                    lowercase=True,
                )
                required = normalize_text(content, lowercase=True)
                if (
                    requirement.category == RequirementCategory.EDUCATION
                    and _education_matches(candidate_facts, required)
                ) or _contains_phrase(candidate_facts, required):
                    matched, evidence = True, content

            result = RequirementMatch(
                requirement=content,
                type=requirement.type,
                matched=matched,
                similarity=1.0 if matched else 0.0,
                evidence=evidence,
                matchMethod="DETERMINISTIC" if matched else "NOT_FOUND",
            )
            target = must_have if requirement.type == RequirementType.MUST_HAVE else should_have
            target.append(result)

        return must_have, should_have
