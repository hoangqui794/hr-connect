import re

from app.schemas.matching_request import MatchingRequest, RequirementCategory, RequirementType
from app.schemas.matching_response import RequirementMatch
from app.services.normalizer import normalize_skill_name, normalize_text


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
                explicit = skill_map.get(lookup)
                if explicit is not None:
                    matched, evidence = True, explicit.name
                elif _contains_phrase(evidence_text, lookup):
                    matched, evidence = True, content
            else:
                candidate_facts = normalize_text(
                    f"{request.candidate.summary} {request.candidate.highest_education or ''} "
                    f"{request.candidate.cv_text}",
                    lowercase=True,
                )
                if _contains_phrase(candidate_facts, normalize_text(content, lowercase=True)):
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
