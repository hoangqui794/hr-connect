"""Matching rules that real job descriptions need beyond literal phrase search.

- Phrases tolerate version and plural suffixes ("HTML5", "CSS3", "Stored Procedures").
- Education compares degree level and an IT major group across Vietnamese and English.
- Experience can be counted per domain ("2 years of .NET") from the parsed work history.
"""

import re
from dataclasses import dataclass
from datetime import date

from app.schemas.matching_request import Candidate, EducationEntry, JobRequirement, WorkRole
from app.services.requirement_evidence import synonyms


def phrase_pattern(phrase: str) -> re.Pattern[str]:
    """Whole-phrase match that also accepts a version number or plural suffix."""
    return re.compile(rf"(?<!\w){re.escape(phrase)}(?:\d+(?:\.\d+)*|e?s)?(?!\w)", re.I)


def contains(text: str, phrase: str) -> bool:
    return bool(phrase) and bool(phrase_pattern(phrase).search(text))


# --- Education -----------------------------------------------------------------

_DEGREE_LEVELS = (
    (1, r"cao đẳng|college|associate"),
    (2, r"đại học|cử nhân|kỹ sư|bachelor|b\.?\s?sc\b|b\.?\s?eng\b|engineer'?s degree|undergraduate|university degree"),
    (3, r"thạc sĩ|master'?s?\b|m\.?\s?sc\b|mba\b"),
    (4, r"tiến sĩ|ph\.?\s?d\b|doctor(?:ate|al)"),
)
_IT_MAJORS = re.compile(
    r"công nghệ thông tin|khoa học máy tính|kỹ thuật phần mềm|hệ thống thông tin|kỹ thuật máy tính|an toàn thông tin|"
    r"khoa học dữ liệu|information technology|computer science|software engineering|information systems|"
    r"computer engineering|information security|cyber ?security|data science|\bIT\b|\bCNTT\b",
    re.I,
)


def _levels(text: str) -> list[int]:
    return [level for level, pattern in _DEGREE_LEVELS if re.search(pattern, text, re.I)]


def education_matches(requirement: str, candidate: Candidate, fallback_text: str) -> bool | None:
    """True/False when the requirement names a degree level or an IT major; None if it names neither."""
    required_levels = _levels(requirement)
    requires_it = bool(_IT_MAJORS.search(requirement))
    if not required_levels and not requires_it:
        return None
    entries = candidate.education or [EducationEntry(degree=candidate.highest_education)]
    # Prefer the parsed education section: free text mentions "Scrum Master" or "engineer".
    texts = [" ".join(filter(None, (entry.degree, entry.major, entry.school))) for entry in entries]
    texts = [text for text in texts if text] or [fallback_text]
    if required_levels:
        candidate_levels = [level for text in texts for level in _levels(text)]
        # "Cao đẳng/Đại học" means either is accepted: the lowest named level is the bar.
        if not candidate_levels or max(candidate_levels) < min(required_levels):
            return False
    if requires_it and not any(_IT_MAJORS.search(text) for text in texts):
        return False
    return True


# --- Domain experience ---------------------------------------------------------

_DOMAIN_TERMS = (
    ".NET", "C#", "ASP.NET", "Java", "Spring", "Kotlin", "Node.js", "NodeJS", "JavaScript", "TypeScript", "Python",
    "Django", "PHP", "Laravel", "Golang", "Ruby", "Rails", "Swift", "Flutter", "React Native", "React", "Angular",
    "Vue", "Unity", "Unreal", "iOS", "Android", "web", "mobile", "backend", "back-end", "frontend", "front-end",
    "fullstack", "full-stack", "full stack", "game", "DevOps", "QA", "tester", "testing", "embedded", "data",
    "machine learning", "AI", "blockchain", "SAP", "Salesforce",
)
_NON_EMPLOYMENT = re.compile(r"intern|thực tập|volunteer|tình nguyện|trainee|fresher program|apprentice", re.I)
_PRESENT = re.compile(r"present|now|current|hiện tại|nay|đến nay", re.I)
_MONTHS = {
    name: index
    for index, names in enumerate(
        (("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"), ("may",), ("jun", "june"),
         ("jul", "july"), ("aug", "august"), ("sep", "sept", "september"), ("oct", "october"), ("nov", "november"),
         ("dec", "december")),
        start=1,
    )
    for name in names
}


def domain_terms(requirement: JobRequirement) -> list[str]:
    """Technology/domain words in an experience requirement ("…on the .NET platform")."""
    if requirement.alternatives:
        return list(requirement.alternatives)
    found = [term for term in _DOMAIN_TERMS if contains(requirement.content, term)]
    # "ASP.NET" also contains ".NET"; keep the more specific term only once.
    return [term for term in found if not any(term != other and term in other for other in found)]


def _month(value: str | None, end: bool, today: date) -> tuple[int, int] | None:
    if not value:
        return None
    text = value.strip().lower()
    if _PRESENT.search(text):
        return today.year, today.month
    year_match = re.search(r"(19|20)\d{2}", text)
    if not year_match:
        return None
    year = int(year_match.group())
    numeric = re.search(r"\b(\d{1,2})\s*[/.-]\s*(?:19|20)\d{2}", text)
    if numeric and 1 <= int(numeric.group(1)) <= 12:
        return year, int(numeric.group(1))
    vietnamese = re.search(r"tháng\s*(\d{1,2})", text)
    if vietnamese and 1 <= int(vietnamese.group(1)) <= 12:
        return year, int(vietnamese.group(1))
    word = re.search(r"[a-z]+", text)
    if word and word.group() in _MONTHS:
        return year, _MONTHS[word.group()]
    return year, 12 if end else 1


@dataclass(frozen=True)
class DomainYears:
    years: float
    roles: list[str]
    unparsed_roles: int


def domain_years(roles: list[WorkRole], terms: list[str], today: date | None = None) -> DomainYears:
    """Years in employment roles that mention a domain term, overlaps merged, internships excluded."""
    today = today or date.today()
    spans: list[tuple[int, int]] = []
    names: list[str] = []
    unparsed = 0
    # "web" experience is shown by Angular/React/REST API work, ".NET" by C#/ASP.NET, etc.
    expanded = [*terms, *(alias for term in terms for alias in synonyms("domainSynonyms", term))]
    for role in roles:
        role_text = " ".join(filter(None, (role.position, role.text)))
        if _NON_EMPLOYMENT.search(role.position or "") or not any(contains(role_text, term) for term in expanded):
            continue
        start = _month(role.start_date, end=False, today=today)
        finish = _month(role.end_date, end=True, today=today) or (start and (today.year, today.month))
        if not start or not finish:
            unparsed += 1
            continue
        first, last = start[0] * 12 + start[1] - 1, finish[0] * 12 + finish[1]
        if last > first:
            spans.append((first, last))
            names.append(role.position or role.company or "role")
    months = 0
    for first, last in _merge(spans):
        months += last - first
    return DomainYears(round(months / 12, 1), names, unparsed)


def _merge(spans: list[tuple[int, int]]) -> list[tuple[int, int]]:
    merged: list[tuple[int, int]] = []
    for first, last in sorted(spans):
        if merged and first <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], last))
        else:
            merged.append((first, last))
    return merged


# --- Core requirements ---------------------------------------------------------

def requirement_terms(requirement: JobRequirement) -> list[str]:
    return list(requirement.alternatives) or [requirement.content]


def is_core_requirement(requirement: JobRequirement, job_text: str) -> bool:
    """A MUST_HAVE skill or experience whose technology the job title/description names."""
    if requirement.category.value == "SKILL":
        return any(contains(job_text, term) for term in requirement_terms(requirement))
    if requirement.category.value == "EXPERIENCE":
        return any(contains(job_text, term) for term in domain_terms(requirement))
    return False
