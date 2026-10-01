import re
from dataclasses import dataclass

from app.schemas.matching_request import (
    JobRequirement,
    MatchingRequest,
    RequirementCategory,
    RequirementOperator,
    RequirementType,
)
from app.schemas.matching_response import RequirementMatch
from app.services.normalizer import extract_skill_alias, normalize_skill_name, normalize_text
from app.services.requirement_evidence import evaluate_clauses


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


@dataclass(frozen=True)
class _RequirementEvaluation:
    matched: bool
    status: str
    coverage: float
    evidence: str | None
    matched_terms: list[str]
    missing_evidence: list[str]


class RequirementMatcher:
    """Deterministic matching; semantic scores never flip rule results."""

    def match(self, request: MatchingRequest) -> tuple[list[RequirementMatch], list[RequirementMatch]]:
        skill_map = {normalize_skill_name(skill.name): skill for skill in request.candidate.skills}
        evidence_text = normalize_text(
            f"{request.candidate.summary} {request.candidate.cv_text}", lowercase=True
        )
        must_have: list[RequirementMatch] = []
        should_have: list[RequirementMatch] = []

        candidate_facts = normalize_text(
            f"{request.candidate.summary} {request.candidate.highest_education or ''} "
            f"{request.candidate.cv_text}",
            lowercase=True,
        )
        for requirement in request.job.requirements:
            content = normalize_text(requirement.content)
            clauses = evaluate_clauses(requirement, request.candidate.cv_text)
            if clauses is not None:
                supported = [item for item in clauses["criteria"] if item["status"] == "MATCHED"]
                result = RequirementMatch(
                    requirement=content, type=requirement.type,
                    matched=clauses["status"] == "MATCHED", matchStatus=clauses["status"],
                    evidenceCoverage=clauses["coverage"], similarity=clauses["coverage"],
                    evidence=" | ".join(item["evidence"]["text"] for item in supported) or None,
                    matchedTerms=[item["criterion"] for item in supported],
                    missingEvidence=[item["criterion"] for item in clauses["criteria"] if item["status"] != "MATCHED"],
                    criteria=clauses["criteria"], warnings=clauses["warnings"], requiresManualReview=True,
                    matchMethod="DETERMINISTIC" if clauses["status"] == "MATCHED" else "DETERMINISTIC_PARTIAL" if clauses["status"] == "PARTIAL" else "NOT_FOUND",
                )
                (must_have if requirement.type == RequirementType.MUST_HAVE else should_have).append(result)
                continue
            evaluation = self._match_requirement(
                requirement, content, skill_map, evidence_text, candidate_facts, request
            )

            result = RequirementMatch(
                requirement=content,
                type=requirement.type,
                matched=evaluation.matched,
                matchStatus=evaluation.status,
                evidenceCoverage=evaluation.coverage,
                similarity=1.0 if evaluation.matched else evaluation.coverage,
                evidence=evaluation.evidence,
                matchedTerms=evaluation.matched_terms,
                missingEvidence=evaluation.missing_evidence,
                matchMethod=(
                    "DETERMINISTIC"
                    if evaluation.status == "MATCHED"
                    else "DETERMINISTIC_PARTIAL"
                    if evaluation.status == "PARTIAL"
                    else "NOT_FOUND"
                ),
                requiresManualReview=(requirement.category == RequirementCategory.OTHER and not evaluation.matched),
                warnings=(["UNRESOLVED_REQUIREMENT_EVIDENCE"] if requirement.category == RequirementCategory.OTHER and not evaluation.matched else []),
            )
            target = must_have if requirement.type == RequirementType.MUST_HAVE else should_have
            target.append(result)

        return must_have, should_have

    @staticmethod
    def _match_requirement(
        requirement: JobRequirement,
        content: str,
        skill_map: dict[str, object],
        evidence_text: str,
        candidate_facts: str,
        request: MatchingRequest,
    ) -> _RequirementEvaluation:
        if requirement.category == RequirementCategory.EXPERIENCE:
            required_years = requirement.min_years or _required_years(content)
            candidate_years = request.candidate.years_of_experience
            if required_years is not None and candidate_years is not None and candidate_years >= required_years:
                return _RequirementEvaluation(True, "MATCHED", 1.0, f"{candidate_years:g} years of experience", [f"{candidate_years:g} years"], [])
            if required_years is None and _contains_phrase(evidence_text, normalize_text(content, lowercase=True)):
                return _RequirementEvaluation(True, "MATCHED", 1.0, content, [content], [])
            return _RequirementEvaluation(False, "NOT_FOUND", 0.0, None, [], [content])

        if requirement.evidence_groups:
            matched_terms: list[str] = []
            missing_groups: list[str] = []
            for index, group in enumerate(requirement.evidence_groups, start=1):
                term = next((item for item in group if _contains_phrase(candidate_facts, item)), None)
                if term is None:
                    missing_groups.append(f"evidence group {index}: {' / '.join(group)}")
                else:
                    matched_terms.append(term)
            coverage = len(matched_terms) / len(requirement.evidence_groups)
            if coverage == 1:
                return _RequirementEvaluation(True, "MATCHED", 1.0, " | ".join(matched_terms), matched_terms, [])
            if coverage > 0:
                return _RequirementEvaluation(False, "PARTIAL", coverage, " | ".join(matched_terms), matched_terms, missing_groups)
            return _RequirementEvaluation(False, "NOT_FOUND", 0.0, None, [], missing_groups)

        terms = requirement.alternatives or [content]
        matched_pairs = [
            (term, RequirementMatcher._match_term(requirement.category, term, skill_map, evidence_text, candidate_facts))
            for term in terms
        ]
        successful = [(term, evidence) for term, evidence in matched_pairs if evidence is not None]
        if requirement.operator == RequirementOperator.ANY_OF:
            if not successful:
                return _RequirementEvaluation(False, "NOT_FOUND", 0.0, None, [], list(terms))
            term, evidence = successful[0]
            return _RequirementEvaluation(True, "MATCHED", 1.0, evidence, [term], [])
        if len(successful) != len(terms):
            matched_terms = [term for term, _ in successful]
            missing_terms = [term for term in terms if term not in matched_terms]
            coverage = len(successful) / len(terms)
            if coverage > 0:
                return _RequirementEvaluation(False, "PARTIAL", coverage, " | ".join(evidence for _, evidence in successful), matched_terms, missing_terms)
            return _RequirementEvaluation(False, "NOT_FOUND", 0.0, None, [], missing_terms)
        return _RequirementEvaluation(True, "MATCHED", 1.0, " | ".join(evidence for _, evidence in successful), [term for term, _ in successful], [])

    @staticmethod
    def _match_term(
        category: RequirementCategory,
        term: str,
        skill_map: dict[str, object],
        evidence_text: str,
        candidate_facts: str,
    ) -> str | None:
        if category == RequirementCategory.SKILL:
            lookup = normalize_skill_name(term)
            canonical = extract_skill_alias(term) or lookup
            explicit = skill_map.get(canonical) or skill_map.get(lookup)
            if explicit is not None:
                return explicit.name
            return canonical if _contains_phrase(evidence_text, canonical) else None
        required = normalize_text(term, lowercase=True)
        if category == RequirementCategory.EDUCATION and _education_matches(candidate_facts, required):
            return term
        return term if _contains_phrase(candidate_facts, required) else None
