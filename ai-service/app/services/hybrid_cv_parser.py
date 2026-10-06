"""Evidence-first layout classification and experience extraction strategies.

This module deliberately returns candidates rather than mutating a parsed CV.
The compatibility facade in :mod:`structured_cv_parser` remains responsible for
all public output models and for deciding whether human review is required.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

from app.schemas.cv import Project, WorkExperience
from app.services.document_parser import DocumentBlock
from app.services.normalizer import normalize_text


class LayoutKind(StrEnum):
    TEXT_ONLY = "TEXT_ONLY"
    SINGLE_COLUMN = "SINGLE_COLUMN"
    MULTI_COLUMN = "MULTI_COLUMN"
    TIMELINE = "TIMELINE"
    OCR_UNPOSITIONED = "OCR_UNPOSITIONED"


@dataclass(frozen=True)
class LayoutClassification:
    kind: LayoutKind
    confidence: float
    diagnostics: tuple[str, ...] = ()


@dataclass(frozen=True)
class ExperienceCandidate:
    company: str
    position: str
    start_date: str
    end_date: str
    evidence: tuple[str, ...]
    strategy: str
    confidence: float
    projects: tuple[Project, ...] = ()
    technologies: tuple[str, ...] = ()


@dataclass(frozen=True)
class ExperienceResolution:
    records: list[WorkExperience]
    warnings: list[str]


_MONTH_WORD = (
    "january|february|march|april|may|june|july|august|september|october|"
    "november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
)
_DATE_VALUE = (
    rf"(?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{{2}}|(?:19|20)\d{{2}}|"
    rf"(?:(?:early|mid|late|đầu|giữa|cuối)\s+)?(?:{_MONTH_WORD})\.?\s+(?:19|20)\d{{2}}|"
    r"tháng\s+(?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}"
)
_CURRENT = r"present|current|now|nay|hiện tại|hiện nay"
_DATE_RANGE = re.compile(
    rf"(?P<start>{_DATE_VALUE})\s*(?:-|–|—|to|đến)\s*(?P<end>{_DATE_VALUE}|{_CURRENT})",
    re.IGNORECASE,
)
_INLINE_TIMELINE = re.compile(
    rf"^\s*(?P<range>{_DATE_RANGE.pattern})\s*[—–]\s*"
    r"(?P<company>[^—–]{2,}?)\s*[—–]\s*(?P<role>[^—–]{2,})\s*$",
    re.IGNORECASE,
)
_YEAR_TIMELINE = re.compile(
    r"^\s*(?P<start>(?:19|20)\d{2})\s*[—–]\s*"
    r"(?P<company>[^—–]{2,}?)\s*[—–]\s*(?P<role>[^—–]{2,})\s*$",
    re.IGNORECASE,
)
_COMPANY_DATE_HEADER = re.compile(
    rf"^\s*(?P<company>.+?)\s*\(\s*(?P<range>{_DATE_RANGE.pattern})\s*\)\s*$",
    re.IGNORECASE,
)
_COMPANY_SINGLE_YEAR_HEADER = re.compile(
    r"^\s*(?P<company>.+?)\s*\(\s*(?P<year>(?:19|20)\d{2})\s*\)\s*$",
    re.IGNORECASE,
)
_DELIMITED_WORK = re.compile(
    rf"^\s*(?P<body>.+?)\s*\|\s*(?P<range>{_DATE_RANGE.pattern})\s*$",
    re.IGNORECASE,
)
_PIPE_ROLE_SUFFIX = re.compile(
    r"(?P<role>(?:(?:senior|junior|lead|principal|staff|full\s+stack|unity|software|game|"
    r"backend|frontend|mobile|devops|data|product|volunteer|research|technical|qa|test|"
    r"ui/ux)\s+){0,3}(?:developer|engineer|intern|manager|planner|advisor|associate|trainee|architect|designer|analyst|"
    r"consultant|specialist|executive|lead|officer|coordinator|supervisor|representative|"
    r"recruiter|accountant|administrator|director|teacher|lecturer|nurse|doctor|pharmacist|"
    r"technician|operator|cashier|sales|marketing|hr))\s*$",
    re.IGNORECASE,
)
_SKIP_ROLE = re.compile(
    r"^(?:responsibilities?|tech stack|technologies?|projects?|education|working history|"
    r"working experience|experience|skills?|summary|profile)\b",
    re.IGNORECASE,
)
_NUMBERED_PROJECT = re.compile(
    r"^\s*\d{1,2}[.)]\s+(?P<name>.+?)(?:\s+\(https?://[^)]+\))?\s*$",
    re.IGNORECASE,
)
_ROLE_HINT = re.compile(
    r"\b(?:developer|engineer|manager|architect|designer|analyst|consultant|intern|"
    r"specialist|executive|lead|officer|coordinator|supervisor|representative|planner|advisor|associate|trainee|"
    r"recruiter|accountant|administrator|director|teacher|lecturer|nurse|doctor|"
    r"pharmacist|technician|operator|cashier|sales|marketing|hr|nhân viên|"
    r"chuyên viên|quản lý|giám sát|kế toán|giáo viên|giảng viên|thực tập)\b",
    re.IGNORECASE,
)


def classify_layout(
    blocks: list[DocumentBlock] | None,
    declared_layout: str | None,
    ocr_applied: bool,
) -> LayoutClassification:
    """Classify only from supplied evidence; missing geometry is never trusted."""
    if not blocks:
        if ocr_applied:
            return LayoutClassification(
                LayoutKind.OCR_UNPOSITIONED, 0.2, ("OCR_POSITION_DATA_UNAVAILABLE",)
            )
        return LayoutClassification(LayoutKind.TEXT_ONLY, 0.45)

    has_date_rail = sum(bool(_DATE_RANGE.search(block.text)) for block in blocks) >= 2
    has_columns = declared_layout == "MULTI_COLUMN" or len({block.column for block in blocks if block.column}) > 1
    if declared_layout == "TIMELINE":
        return LayoutClassification(LayoutKind.TIMELINE, 0.85)
    if has_date_rail and has_columns:
        return LayoutClassification(LayoutKind.TIMELINE, 0.8)
    if has_columns:
        return LayoutClassification(LayoutKind.MULTI_COLUMN, 0.75)
    return LayoutClassification(LayoutKind.SINGLE_COLUMN, 0.8)


class InlineTimelineStrategy:
    name = "inline_timeline"

    def extract(self, lines: list[str]) -> list[ExperienceCandidate]:
        candidates: list[ExperienceCandidate] = []
        for line in lines:
            match = _INLINE_TIMELINE.match(line)
            if match:
                range_match = _DATE_RANGE.search(match.group("range"))
                assert range_match is not None
                candidates.append(
                    ExperienceCandidate(
                        company=match.group("company").strip(),
                        position=match.group("role").strip(),
                        start_date=range_match.group("start"),
                        end_date=range_match.group("end"),
                        evidence=(line,),
                        strategy=self.name,
                        confidence=0.9,
                    )
                )
                continue

            year_match = _YEAR_TIMELINE.match(line)
            if year_match:
                candidates.append(
                    ExperienceCandidate(
                        company=year_match.group("company").strip(),
                        position=year_match.group("role").strip(),
                        start_date=year_match.group("start"),
                        end_date=year_match.group("start"),
                        evidence=(line,),
                        strategy=self.name,
                        confidence=0.82,
                    )
                )
        return candidates


class CompanyDateHeaderStrategy:
    name = "company_date_header"

    def extract(self, lines: list[str]) -> list[ExperienceCandidate]:
        candidates: list[ExperienceCandidate] = []
        for index, line in enumerate(lines[:-1]):
            match = _COMPANY_DATE_HEADER.match(line)
            single_year_match = _COMPANY_SINGLE_YEAR_HEADER.match(line) if match is None else None
            if match is None and single_year_match is None:
                continue
            role = lines[index + 1].strip()
            if not role or _SKIP_ROLE.search(role):
                continue
            if match is not None:
                range_match = _DATE_RANGE.search(match.group("range"))
                if range_match is None:
                    continue
                company = match.group("company").strip()
                start_date = range_match.group("start")
                end_date = range_match.group("end")
            else:
                assert single_year_match is not None
                company = single_year_match.group("company").strip()
                start_date = single_year_match.group("year")
                end_date = start_date
            projects, technologies = self._details_after_role(lines, index + 2)
            candidates.append(
                ExperienceCandidate(
                    company=company,
                    position=role,
                    start_date=start_date,
                    end_date=end_date,
                    evidence=(line, role),
                    strategy=self.name,
                    confidence=0.9,
                    projects=projects,
                    technologies=technologies,
                )
            )
        return candidates

    @staticmethod
    def _details_after_role(
        lines: list[str], start_index: int
    ) -> tuple[tuple[Project, ...], tuple[str, ...]]:
        """Read bounded projects and an employer-level technology stack.

        A stack immediately after a role belongs to that employment, while a
        stack after a numbered project belongs to that project.  Both scopes
        must stop at every company header, including ``Company (2022)``.
        """
        projects: list[Project] = []
        technologies: list[str] = []
        collect_description = False
        collect_technologies = False
        for line in lines[start_index:]:
            if (
                _COMPANY_DATE_HEADER.match(line)
                or _COMPANY_SINGLE_YEAR_HEADER.match(line)
                or _INLINE_TIMELINE.match(line)
                or _YEAR_TIMELINE.match(line)
            ):
                break
            match = _NUMBERED_PROJECT.match(line)
            if match is not None:
                name = re.sub(r"\s+\(https?://[^)]+\)\s*$", "", match.group("name")).strip()
                lowered = name.casefold()
                if (
                    len(name.split()) > 8
                    or "://" in name
                    or lowered.startswith(("responsibilit", "technology", "tech stack", "task"))
                    or not name[0].isupper()
                ):
                    continue
                projects.append(
                    Project(
                        name=name,
                        evidence=line,
                        confidence=0.85,
                        sourceSection="experience",
                    )
                )
                collect_description = True
                collect_technologies = False
                continue

            if re.match(r"^(?:responsibilities|tech stack|technologies)\s*:", line, re.IGNORECASE):
                collect_description = False
                collect_technologies = line.casefold().startswith(("tech stack", "technologies"))
                if collect_technologies:
                    values = CompanyDateHeaderStrategy._technology_values(
                        line.split(":", maxsplit=1)[-1]
                    )
                    if projects:
                        projects[-1] = projects[-1].model_copy(update={"technologies": values})
                    else:
                        technologies = values
                continue
            if collect_description and len(line) >= 24:
                previous = projects[-1]
                description = " ".join(part for part in (previous.description, line) if part)
                projects[-1] = previous.model_copy(update={"description": description, "evidence": f"{previous.evidence} | {line}"})
                continue
            if collect_technologies:
                values = CompanyDateHeaderStrategy._technology_values(line)
                if projects:
                    merged = CompanyDateHeaderStrategy._merge_technologies(
                        projects[-1].technologies, values
                    )
                    projects[-1] = projects[-1].model_copy(update={"technologies": merged})
                else:
                    technologies = CompanyDateHeaderStrategy._merge_technologies(technologies, values)
        return tuple(projects), tuple(technologies)

    @staticmethod
    def _technology_values(value: str) -> list[str]:
        return [item.strip() for item in re.split(r"[,|]", value) if item.strip()]

    @staticmethod
    def _merge_technologies(existing: list[str], additions: list[str]) -> list[str]:
        merged = list(existing)
        remaining = list(additions)
        if merged and remaining and merged[-1].casefold() == "dnd" and remaining[0].casefold() == "kit":
            merged[-1] = "dnd kit"
            remaining.pop(0)
        merged.extend(remaining)
        unique: list[str] = []
        seen: set[str] = set()
        for item in merged:
            key = item.casefold()
            if key not in seen:
                seen.add(key)
                unique.append(item)
        return unique


class DelimitedWorkStrategy:
    """Read common ``Role - Company | Date`` and inverse text-layer records."""

    name = "delimited_work"

    def extract(self, lines: list[str]) -> list[ExperienceCandidate]:
        candidates: list[ExperienceCandidate] = []
        for line in lines:
            match = _DELIMITED_WORK.match(line)
            if not match:
                continue
            range_match = _DATE_RANGE.search(match.group("range"))
            assert range_match is not None
            pipe_parts = [part.strip() for part in match.group("body").split("|") if part.strip()]
            if len(pipe_parts) >= 2:
                role_match = _PIPE_ROLE_SUFFIX.search(pipe_parts[-1])
                if role_match:
                    candidates.append(
                        ExperienceCandidate(
                            company=pipe_parts[0],
                            position=role_match.group("role").strip(),
                            start_date=range_match.group("start"),
                            end_date=range_match.group("end"),
                            evidence=(line,),
                            strategy=self.name,
                            confidence=0.9,
                        )
                    )
                    continue
            parts = re.split(r"\s+-\s+", match.group("body"), maxsplit=1)
            if len(parts) != 2:
                continue
            left, right = (part.strip() for part in parts)
            left_is_role, right_is_role = bool(_ROLE_HINT.search(left)), bool(_ROLE_HINT.search(right))
            if left_is_role == right_is_role:
                continue
            company, role = (right, left) if left_is_role else (left, right)
            candidates.append(
                ExperienceCandidate(
                    company=company,
                    position=role,
                    start_date=range_match.group("start"),
                    end_date=range_match.group("end"),
                    evidence=(line,),
                    strategy=self.name,
                    confidence=0.88,
                )
            )
        return candidates


class SpatialDateRailStrategy:
    """Recover work rows whose employer and date occupy separate PDF columns.

    This is geometry-driven, not template-driven: a candidate is emitted only
    where Company, Role and Date are locally aligned on the same page.
    """

    name = "spatial_date_rail"

    @staticmethod
    def _centre_y(block: DocumentBlock) -> float:
        return (block.bbox[1] + block.bbox[3]) / 2

    @staticmethod
    def _is_company(text: str) -> bool:
        if not text or _DATE_RANGE.search(text) or _SKIP_ROLE.search(text):
            return False
        if "|" in text:
            first = text.split("|", maxsplit=1)[0].strip()
            return bool(first) and not _ROLE_HINT.search(first)
        return not _ROLE_HINT.search(text) and len(text.split()) <= 12

    def extract(self, blocks: list[DocumentBlock] | None) -> list[ExperienceCandidate]:
        if not blocks:
            return []
        by_page: dict[int, list[DocumentBlock]] = {}
        for block in blocks:
            if block.text.strip():
                by_page.setdefault(block.page, []).append(block)
        candidates: list[ExperienceCandidate] = []
        for page_blocks in by_page.values():
            for date_block in page_blocks:
                date_match = _DATE_RANGE.search(date_block.text)
                if date_match is None:
                    continue
                date_y = self._centre_y(date_block)
                companies = [
                    block for block in page_blocks
                    if block.bbox[2] <= date_block.bbox[0] + 10
                    and abs(self._centre_y(block) - date_y) <= 16
                    and self._is_company(block.text.strip())
                ]
                if not companies:
                    continue
                company_block = min(companies, key=lambda block: abs(self._centre_y(block) - date_y))
                roles = [
                    block for block in page_blocks
                    if block is not company_block
                    and block.bbox[0] <= date_block.bbox[0]
                    and -18 <= self._centre_y(block) - date_y <= 48
                    and _ROLE_HINT.search(block.text)
                    and not _DATE_RANGE.search(block.text)
                ]
                if not roles:
                    continue
                role_block = min(roles, key=lambda block: abs(self._centre_y(block) - date_y))
                candidates.append(ExperienceCandidate(
                    company=company_block.text.strip(),
                    position=role_block.text.strip(),
                    start_date=date_match.group("start"),
                    end_date=date_match.group("end"),
                    evidence=(company_block.text, date_block.text, role_block.text),
                    strategy=self.name,
                    confidence=0.9,
                ))
        return candidates


class HybridExperienceParser:
    """Run bounded strategies selected from document evidence.

    The strategies are intentionally additive. The established sequential parser
    remains a source of candidates in ``StructuredCvParser`` and the resolver
    below decides whether the sources can be combined safely.
    """

    def __init__(self) -> None:
        self._inline = InlineTimelineStrategy()
        self._header = CompanyDateHeaderStrategy()
        self._delimited = DelimitedWorkStrategy()
        self._spatial = SpatialDateRailStrategy()

    def extract(
        self,
        lines: list[str],
        blocks: list[DocumentBlock] | None,
        declared_layout: str | None,
        ocr_applied: bool,
    ) -> tuple[list[ExperienceCandidate], LayoutClassification]:
        layout = classify_layout(blocks, declared_layout, ocr_applied)
        candidates = [
            *self._inline.extract(lines),
            *self._header.extract(lines),
            *self._delimited.extract(lines),
            *self._spatial.extract(blocks),
        ]
        return candidates, layout


class ExperienceResolver:
    """Merge evidence-backed experience candidates without inventing records."""

    @staticmethod
    def _has_local_evidence(record: WorkExperience) -> bool:
        """Require Company, Role and Date evidence to occur in one local group.

        Text-layer PDFs can interleave a later date rail with a previously seen
        employer. A sequential candidate is valid only when its three parts
        are adjacent (or share a line) in the captured evidence; otherwise the
        resolver leaves it to a safer strategy or manual review.
        """
        if not (record.position and record.start_date and record.end_date):
            return False
        parts = [normalize_text(part, lowercase=True) for part in (record.evidence or "").split("|")]
        if not parts:
            return False
        position = normalize_text(record.position, lowercase=True).strip(" |-–—")
        start = normalize_text(record.start_date, lowercase=True)
        end = normalize_text(record.end_date, lowercase=True)
        position_indexes = [index for index, part in enumerate(parts) if position in part]
        date_indexes = [index for index, part in enumerate(parts) if start in part and end in part]
        if record.company is None:
            if len(record.projects) != 1 or not record.projects[0].name:
                return False
            project_name = normalize_text(record.projects[0].name, lowercase=True).strip(" |-–—")
            project_indexes = [index for index, part in enumerate(parts) if project_name in part]
            return any(
                max(project_index, position_index, date_index)
                - min(project_index, position_index, date_index)
                <= 2
                for project_index in project_indexes
                for position_index in position_indexes
                for date_index in date_indexes
            )
        company = normalize_text(record.company, lowercase=True).strip(" |-–—")
        company_indexes = [index for index, part in enumerate(parts) if company in part]
        return any(
            max(company_index, position_index, date_index)
            - min(company_index, position_index, date_index)
            <= 2
            for company_index in company_indexes
            for position_index in position_indexes
            for date_index in date_indexes
        )

    @staticmethod
    def _key(company: str, position: str, start_date: str, end_date: str) -> tuple[str, str, str, str]:
        return tuple(
            normalize_text(value, lowercase=True).strip(" |-–—")
            for value in (company, position, start_date, end_date)
        )

    @classmethod
    def resolve(
        cls,
        sequential: list[WorkExperience],
        hybrid: list[ExperienceCandidate],
    ) -> ExperienceResolution:
        accepted: dict[tuple[str, str, str, str], WorkExperience] = {}
        conflicts: set[tuple[str, str, str]] = set()

        def identity(company: str | None, start_date: str, end_date: str) -> tuple[str, str, str]:
            return tuple(
                normalize_text(value, lowercase=True).strip(" |-–—")
                for value in (company or "employer-not-stated", start_date, end_date)
            )

        def add(record: WorkExperience) -> None:
            if not (record.position and record.start_date and record.end_date):
                return
            company_key = record.company or "employer-not-stated"
            key = cls._key(company_key, record.position, record.start_date, record.end_date)
            same_employment = identity(record.company, record.start_date, record.end_date)
            for existing_key, existing in list(accepted.items()):
                if identity(existing.company or "", existing.start_date or "", existing.end_date or "") != same_employment:
                    continue
                if existing_key != key:
                    same_evidence = normalize_text(existing.evidence or "", lowercase=True) == normalize_text(
                        record.evidence or "", lowercase=True
                    )
                    existing_position = existing.position or ""
                    record_position = record.position or ""
                    if same_evidence and "|" in existing_position and "|" not in record_position:
                        accepted.pop(existing_key)
                        break
                    if same_evidence and "|" not in existing_position and "|" in record_position:
                        return
                    conflicts.add(same_employment)
                    accepted.pop(existing_key)
                    return
            if same_employment not in conflicts:
                existing = accepted.get(key)
                if existing is None or (
                    not existing.projects and record.projects
                ) or (
                    not existing.technologies and record.technologies
                ):
                    accepted[key] = record

        for record in sequential:
            if cls._has_local_evidence(record):
                add(record)
        for candidate in hybrid:
            add(
                WorkExperience(
                    company=candidate.company,
                    position=candidate.position,
                    startDate=candidate.start_date,
                    endDate=candidate.end_date,
                    evidence=" | ".join(candidate.evidence),
                    description=" | ".join(candidate.evidence),
                    projects=list(candidate.projects),
                    technologies=list(candidate.technologies),
                    confidence=candidate.confidence,
                    sourceSection="experience",
                )
            )

        warnings = ["EXPERIENCE_EVIDENCE_CONFLICT"] if conflicts else []
        return ExperienceResolution(list(accepted.values()), warnings)
