import re
from dataclasses import dataclass

from app.core.config import get_settings
from app.schemas.matching_request import (
    JobRequirement,
    MatchingRequest,
    RequirementCategory,
    RequirementOperator,
    RequirementType,
)
from app.schemas.matching_response import RequirementMatch
from app.services.normalizer import extract_skill_alias, normalize_skill_name, normalize_text
from app.services.requirement_evidence import evaluate_clauses, synonyms
from app.services.requirement_rules import (
    domain_terms,
    domain_years,
    education_matches,
    is_core_requirement,
    phrase_pattern,
)


def _contains_phrase(text: str, phrase: str) -> bool:
    negative_context = re.compile(
        r"(?:without|no|not|lacks?|missing|không\s+có|chưa\s+có|thiếu)\s+$",
        flags=re.IGNORECASE,
    )
    for match in phrase_pattern(phrase).finditer(text):
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
    warnings: tuple[str, ...] = ()


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
                if clauses["status"] == "NOT_FOUND" and _evidence_is_unreadable(requirement, request):
                    clauses = {**clauses, "status": "UNKNOWN", "coverage": 0.0}
                supported = [item for item in clauses["criteria"] if item["status"] == "MATCHED"]
                result = RequirementMatch(
                    requirement=content, type=requirement.type,
                    matched=clauses["status"] == "MATCHED", matchStatus=clauses["status"],
                    evidenceCoverage=clauses["coverage"], similarity=clauses["coverage"],
                    evidence=" | ".join(item["evidence"]["text"] for item in supported) or None,
                    matchedTerms=[item["criterion"] for item in supported],
                    missingEvidence=[item["criterion"] for item in clauses["criteria"] if item["status"] != "MATCHED"],
                    criteria=clauses["criteria"], warnings=clauses["warnings"], requiresManualReview=True,
                    knockout=requirement.knockout,
                    matchMethod="DETERMINISTIC" if clauses["status"] == "MATCHED" else "DETERMINISTIC_PARTIAL" if clauses["status"] == "PARTIAL" else "UNKNOWN" if clauses["status"] == "UNKNOWN" else "NOT_FOUND",
                )
                (must_have if requirement.type == RequirementType.MUST_HAVE else should_have).append(result)
                continue
            evaluation = self._match_requirement(
                requirement, content, skill_map, evidence_text, candidate_facts, request
            )
            if requirement.category == RequirementCategory.SKILL and evaluation.matched_terms:
                evaluation = _discount_weak_mentions(evaluation, requirement, request.candidate.cv_text, skill_map)
            if evaluation.status == "NOT_FOUND" and _evidence_is_unreadable(requirement, request):
                evaluation = _RequirementEvaluation(
                    False, "UNKNOWN", 0.0, None, [], evaluation.missing_evidence
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
                    else "UNKNOWN"
                    if evaluation.status == "UNKNOWN"
                    else "NOT_FOUND"
                ),
                requiresManualReview=(
                    bool(evaluation.warnings)
                    or evaluation.status == "UNKNOWN"
                    or (requirement.category == RequirementCategory.OTHER and not evaluation.matched)
                ),
                warnings=list(evaluation.warnings) + (
                    ["SOURCE_EVIDENCE_UNREADABLE"]
                    if evaluation.status == "UNKNOWN"
                    else ["UNRESOLVED_REQUIREMENT_EVIDENCE"]
                    if requirement.category == RequirementCategory.OTHER and not evaluation.matched
                    else []
                ),
            )
            result.knockout = requirement.knockout
            target = must_have if requirement.type == RequirementType.MUST_HAVE else should_have
            target.append(result)

        if get_settings().infer_core_requirements:
            # Results keep the job's order within each type.
            job_text = f"{request.job.title}\n{request.job.description}"
            requirements = [r for r in request.job.requirements if r.type == RequirementType.MUST_HAVE]
            for requirement, item in zip(requirements, must_have):
                item.core = is_core_requirement(requirement, job_text)
        for item in must_have:
            if item.knockout and item.match_status != "MATCHED":
                item.requires_manual_review = True
                item.warnings = [*item.warnings, "KNOCKOUT_NOT_MET"]
            elif item.core and item.match_status == "NOT_FOUND":
                item.requires_manual_review = True
                item.warnings = [*item.warnings, "CORE_REQUIREMENT_MISSING"]
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
        if requirement.category == RequirementCategory.EDUCATION:
            verdict = education_matches(content, request.candidate, candidate_facts)
            if verdict is not None:
                return (
                    _RequirementEvaluation(True, "MATCHED", 1.0, request.candidate.highest_education or content, [content], [])
                    if verdict
                    else _RequirementEvaluation(False, "NOT_FOUND", 0.0, None, [], [content])
                )

        if requirement.category == RequirementCategory.EXPERIENCE:
            required_years = requirement.min_years or _required_years(content)
            terms = domain_terms(requirement)
            if required_years is not None and terms and request.candidate.work_experience:
                return _domain_experience(required_years, terms, request)
            candidate_years = request.candidate.years_of_experience
            if required_years is not None and candidate_years is not None and candidate_years >= required_years:
                # Total years stand in for domain years only when no work history was supplied.
                unverified = ("DOMAIN_YEARS_UNVERIFIED",) if terms else ()
                return _RequirementEvaluation(True, "MATCHED", 1.0, f"{candidate_years:g} years of experience", [f"{candidate_years:g} years"], [], unverified)
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
            if _contains_phrase(evidence_text, canonical):
                return canonical
            # Configured equivalents: "Git" is shown by GitHub/GitLab, "SQL" by PostgreSQL.
            return next(
                (alias for alias in synonyms("skillSynonyms", term) if _contains_phrase(evidence_text, alias)), None
            )
        required = normalize_text(term, lowercase=True)
        if category == RequirementCategory.EDUCATION and _education_matches(candidate_facts, required):
            return term
        return term if _contains_phrase(candidate_facts, required) else None


def _evidence_is_unreadable(
    requirement: JobRequirement, request: MatchingRequest
) -> bool:
    fields = set(request.candidate.unreliable_evidence_fields)
    if "all" in fields:
        return True
    field_by_category = {
        RequirementCategory.SKILL: "skills",
        RequirementCategory.EXPERIENCE: "experience",
        RequirementCategory.EDUCATION: "education",
        RequirementCategory.OTHER: "other",
    }
    return field_by_category[requirement.category] in fields


_LIST_LABEL = re.compile(
    r"^\W*(?:tech(?:nical)?\s*stack|technolog\w*|skills?|tools?|languages?|frameworks?|kỹ năng|công nghệ)\b", re.I
)


def _is_narrative_line(line: str) -> bool:
    """A prose sentence, not a skills list or tech-stack line."""
    return (
        len(line.split()) >= 8
        and ":" not in line
        and line.count(",") < 2
        and not _LIST_LABEL.search(line)
    )


_MIN_CV_CHARS_FOR_MENTION_COUNT = 600


def _is_weak_single_mention(term: str, cv_text: str) -> bool:
    """One passing mention in prose ("ported a game to .NET in one night") is not a skill claim."""
    pattern = phrase_pattern(term)
    hits = [line for line in cv_text.splitlines() if pattern.search(line)]
    occurrences = sum(len(pattern.findall(line)) for line in hits)
    return occurrences == 1 and _is_narrative_line(hits[0])


def _discount_weak_mentions(
    evaluation: _RequirementEvaluation,
    requirement: JobRequirement,
    cv_text: str,
    skill_map: dict[str, object],
) -> _RequirementEvaluation:
    # Mention counts mean nothing in a short text, and a skill the candidate
    # declared with years of experience is a deliberate claim.
    if len(cv_text) < _MIN_CV_CHARS_FOR_MENTION_COUNT:
        return evaluation

    def declared_with_years(term: str) -> bool:
        skill = skill_map.get(normalize_skill_name(term))
        return getattr(skill, "years_of_experience", None) is not None

    weak = [
        term for term in evaluation.matched_terms
        if not declared_with_years(term) and _is_weak_single_mention(term, cv_text)
    ]
    if not weak:
        return evaluation
    strong = [term for term in evaluation.matched_terms if term not in weak]
    terms = requirement.alternatives or [requirement.content]
    if requirement.operator == RequirementOperator.ANY_OF:
        coverage = 1.0 if strong else 0.0
    else:
        coverage = len(strong) / len(terms) if strong else 0.0
    status = "MATCHED" if coverage == 1 else "PARTIAL" if coverage > 0 else "NOT_FOUND"
    return _RequirementEvaluation(
        status == "MATCHED", status, coverage,
        " | ".join(strong) or None, strong,
        [*evaluation.missing_evidence, *(f"{term} (single passing mention)" for term in weak)],
        ("WEAK_SINGLE_MENTION",),
    )


def _domain_experience(required_years: float, terms: list[str], request: MatchingRequest) -> _RequirementEvaluation:
    """Years in roles that mention the requirement's domain, not total career length."""
    result = domain_years(request.candidate.work_experience, terms)
    warnings = ("ROLE_DATES_UNREADABLE",) if result.unparsed_roles else ()
    evidence = f"{result.years:g} years in {', '.join(terms)} roles" + (
        f" ({'; '.join(result.roles)})" if result.roles else ""
    )
    if result.years >= required_years:
        return _RequirementEvaluation(True, "MATCHED", 1.0, evidence, [f"{result.years:g} years"], [], warnings)
    if result.years > 0:
        return _RequirementEvaluation(
            False, "PARTIAL", round(result.years / required_years, 4), evidence, [f"{result.years:g} years"],
            [f"{required_years:g} years of {', '.join(terms)}"], warnings,
        )
    return _RequirementEvaluation(False, "NOT_FOUND", 0.0, None, [], [f"{required_years:g} years of {', '.join(terms)}"], warnings)
