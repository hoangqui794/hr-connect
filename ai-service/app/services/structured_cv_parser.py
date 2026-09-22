from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from app.schemas.cv import Certification, Education, LanguageSkill, ParsedSkill, StructuredCandidate, WorkExperience
from app.services.document_parser import DocumentBlock
from app.services.normalizer import normalize_skill_name, normalize_text


_EMAIL = re.compile(r"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+", re.IGNORECASE)
_PHONE = re.compile(r"(?<!\d)(?:\+?84|0)(?:[ .()/-]*\d){8,10}(?!\d)")
_MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7,
    "july": 7, "aug": 8, "august": 8, "sep": 9, "sept": 9,
    "september": 9, "oct": 10, "october": 10, "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}
_MONTH_WORD = "|".join(sorted(_MONTHS, key=len, reverse=True))
_DATE_VALUE = rf"(?:0?[1-9]|1[0-2])[/.-]\d{{4}}|(?:19|20)\d{{2}}|(?:{_MONTH_WORD})\.?\s+\d{{4}}|tháng\s+(?:0?[1-9]|1[0-2])[/.-]\d{{4}}"
_DATE_RANGE = re.compile(
    rf"(?P<start>{_DATE_VALUE})\s*(?:-|–|—|to|đến)\s*"
    rf"(?P<end>{_DATE_VALUE}|present|current|now|hiện tại)", re.IGNORECASE,
)
_HEADINGS = {
    "summary": {"summary", "profile", "giới thiệu", "tóm tắt", "career objective", "mục tiêu nghề nghiệp"},
    "skills": {"skills", "technical skills", "core skills", "kỹ năng", "kỹ năng chuyên môn"},
    "experience": {"experience", "work experience", "professional experience", "employment history", "kinh nghiệm", "kinh nghiệm làm việc"},
    "education": {"education", "academic background", "học vấn", "giáo dục"},
    "certifications": {"certificate", "certificates", "certifications", "chứng chỉ", "chứng nhận"},
    "languages": {"languages", "language", "ngôn ngữ", "ngoại ngữ"},
    "projects": {"projects", "project", "dự án"},
    "contact": {"contact", "contact information", "liên hệ", "thông tin liên hệ"},
}
_SKILL_ALIASES = {
    "c#": {"c#", "c sharp"}, ".net": {".net", ".net core", "dotnet"},
    "asp.net core": {"asp.net core", "asp net core", "aspnet core"}, "java": {"java"},
    "python": {"python"}, "javascript": {"javascript"}, "typescript": {"typescript"},
    "react": {"react", "reactjs", "react.js"}, "flutter": {"flutter"}, "dart": {"dart"},
    "node.js": {"node.js", "nodejs"}, "docker": {"docker"},
    "docker compose": {"docker compose"}, "kubernetes": {"kubernetes"},
    "postgresql": {"postgresql", "postgres"}, "mysql": {"mysql"},
    "sql server": {"sql server", "ms sql server", "mssql"}, "mongodb": {"mongodb"},
    "redis": {"redis"}, "aws": {"aws", "amazon web services"}, "aws s3": {"aws s3"},
    "azure": {"azure"}, "git": {"git"}, "github actions": {"github actions"},
    "rest api": {"rest api", "restful api", "restful apis"}, "signalr": {"signalr"},
    "microservices": {"microservices", "microservice"},
    "clean architecture": {"clean architecture"},
    "entity framework core": {"entity framework core", "ef core"}, "linq": {"linq"},
    "postman": {"postman"}, "nginx": {"nginx"}, "fastapi": {"fastapi"},
    "machine learning": {"machine learning"},
}
_LANGUAGE_NAMES = {
    "english": "English", "tiếng anh": "English", "vietnamese": "Vietnamese",
    "tiếng việt": "Vietnamese", "japanese": "Japanese", "tiếng nhật": "Japanese",
    "korean": "Korean", "tiếng hàn": "Korean", "chinese": "Chinese",
    "tiếng trung": "Chinese", "french": "French", "tiếng pháp": "French",
    "german": "German", "tiếng đức": "German",
}


@dataclass(frozen=True)
class StructuredParseResult:
    candidate: StructuredCandidate
    confidence: float
    requires_manual_review: bool
    warnings: list[str]


class StructuredCvParser:
    def parse(self, raw_text: str, job_skills: list[str] | None = None, blocks: list[DocumentBlock] | None = None) -> StructuredCandidate:
        return self.parse_with_diagnostics(raw_text, job_skills, blocks).candidate

    def parse_with_diagnostics(self, raw_text: str, job_skills: list[str] | None = None, blocks: list[DocumentBlock] | None = None) -> StructuredParseResult:
        text = normalize_text(raw_text)
        lines = [line.strip(" \t•*-|") for line in raw_text.splitlines() if line.strip(" \t•*-|")]
        sections, line_sections = self._split_sections(lines)
        email_match, phone_match = _EMAIL.search(text), _PHONE.search(text)
        experience, intervals = self._parse_experience(sections.get("experience", []))
        full_name = self._find_name(lines, blocks or [])
        candidate = StructuredCandidate(
            fullName=full_name,
            email=email_match.group(0) if email_match else None,
            phone=self._normalize_phone(phone_match.group(0)) if phone_match else None,
            summary=" ".join(sections.get("summary", [])) or None,
            totalYearsOfExperience=self._total_years(intervals),
            skills=self._parse_skills(lines, line_sections, job_skills or []),
            education=self._parse_education(sections.get("education", [])),
            certifications=self._parse_certifications(sections.get("certifications", [])),
            workExperience=experience,
            languages=self._parse_languages(lines, line_sections),
        )
        warnings: list[str] = []
        if full_name is None:
            warnings.append("FULL_NAME_LOW_CONFIDENCE")
        if not sections:
            warnings.append("NO_SECTIONS_DETECTED")
        if "experience" in sections and sections["experience"] and not experience:
            warnings.append("EXPERIENCE_DATE_NOT_DETECTED")
        confidence = self._confidence(candidate, sections)
        return StructuredParseResult(candidate, confidence, confidence < 0.6 or bool(warnings), warnings)

    @classmethod
    def _heading_match(cls, line: str) -> tuple[str, str] | None:
        cleaned = re.sub(r"[:\s]+$", "", normalize_text(line, lowercase=True))
        for section, headings in _HEADINGS.items():
            for heading in sorted(headings, key=len, reverse=True):
                if cleaned == heading:
                    return section, ""
                if cleaned.startswith(heading + " "):
                    return section, line[len(heading):].strip(" :-")
        return None

    @classmethod
    def _split_sections(cls, lines: list[str]) -> tuple[dict[str, list[str]], dict[str, str | None]]:
        sections: dict[str, list[str]] = {}
        line_sections: dict[str, str | None] = {}
        current: str | None = None
        for line in lines:
            heading = cls._heading_match(line)
            if heading:
                current, remainder = heading
                sections.setdefault(current, [])
                line_sections[line] = current
                if remainder:
                    sections[current].append(remainder)
                    line_sections[remainder] = current
            else:
                line_sections[line] = current
                if current:
                    sections[current].append(line)
        return sections, line_sections

    @classmethod
    def _find_name(cls, lines: list[str], blocks: list[DocumentBlock]) -> str | None:
        block_map = {block.text: block for block in blocks}
        max_font = max((block.font_size for block in blocks), default=0)
        ranked: list[tuple[float, str]] = []
        for index, line in enumerate(lines[:20]):
            candidate = normalize_text(line)
            if cls._heading_match(candidate) or _EMAIL.search(candidate) or _PHONE.search(candidate):
                continue
            lowered = candidate.casefold()
            if any(token in lowered for token in ("http", "www.", "objective", "developer", "engineer", "student", "university", "experience")):
                continue
            words = candidate.split()
            if not 2 <= len(words) <= 6 or len(candidate) > 60 or any(character.isdigit() for character in candidate):
                continue
            letters = sum(character.isalpha() for character in candidate)
            if letters < max(4, int(len(candidate) * 0.65)):
                continue
            score = 0.45 + max(0, 0.2 - index * 0.01)
            if candidate.isupper():
                score += 0.15
            block = block_map.get(candidate)
            if block and max_font and block.font_size >= max_font * 0.85:
                score += 0.2
            if block and block.is_bold:
                score += 0.1
            ranked.append((score, candidate))
        if not ranked:
            return None
        score, candidate = max(ranked)
        return candidate if score >= 0.65 else None

    @staticmethod
    def _normalize_phone(value: str) -> str:
        prefix = "+" if value.strip().startswith("+") else ""
        return prefix + re.sub(r"\D", "", value)

    def _parse_skills(self, lines: list[str], line_sections: dict[str, str | None], job_skills: list[str]) -> list[ParsedSkill]:
        aliases = {name: set(values) for name, values in _SKILL_ALIASES.items()}
        for requested in job_skills:
            canonical = normalize_skill_name(requested)
            aliases.setdefault(canonical, set()).add(requested.casefold())
        results: dict[str, ParsedSkill] = {}
        for canonical, variants in aliases.items():
            for line in lines:
                lowered = normalize_text(line, lowercase=True)
                matched = next((variant for variant in sorted(variants, key=len, reverse=True) if re.search(rf"(?<!\w){re.escape(variant)}(?!\w)", lowered) and self._positive_phrase(lowered, variant)), None)
                if matched is None:
                    continue
                source = line_sections.get(line)
                results[canonical] = ParsedSkill(name=canonical, evidence=line, confidence=0.95 if source == "skills" else 0.8, sourceSection=source)
                break
        return sorted(results.values(), key=lambda item: item.name)

    @staticmethod
    def _positive_phrase(text: str, phrase: str) -> bool:
        pattern = re.compile(rf"(?<!\w){re.escape(phrase)}(?!\w)", re.IGNORECASE)
        negative = re.compile(r"(?:without|no|not|lacks?|missing|không\s+có|chưa\s+có|thiếu)\s+$", re.IGNORECASE)
        return any(not negative.search(text[max(0, match.start() - 24):match.start()]) for match in pattern.finditer(text))

    def _parse_experience(self, lines: list[str]) -> tuple[list[WorkExperience], list[tuple[int, int]]]:
        results: list[WorkExperience] = []
        intervals: list[tuple[int, int]] = []
        index = 0
        while index < len(lines):
            line = lines[index]
            if index + 1 < len(lines) and not _DATE_RANGE.search(line):
                joined = f"{line} {lines[index + 1]}"
                if _DATE_RANGE.search(joined):
                    line = joined
                    index += 1
            match = _DATE_RANGE.search(line)
            if not match:
                index += 1
                continue
            start, end = self._month_index(match.group("start"), is_end=False), self._month_index(match.group("end"), is_end=True)
            if start is None or end is None or end < start:
                index += 1
                continue
            intervals.append((start, end))
            identity = line[:match.start()].strip(" ,-–—")
            parts = [part.strip() for part in identity.split("|", maxsplit=1)]
            results.append(WorkExperience(
                company=parts[0] or None, position=parts[1] if len(parts) > 1 else None,
                startDate=match.group("start"), endDate=match.group("end"), description=line,
                evidence=line, confidence=0.85, sourceSection="experience",
            ))
            index += 1
        return results, intervals

    @staticmethod
    def _month_index(value: str, *, is_end: bool) -> int | None:
        cleaned = normalize_text(value, lowercase=True).replace(".", "")
        if cleaned in {"present", "current", "now", "hiện tại"}:
            today = date.today()
            return today.year * 12 + today.month - 1
        month_word = next((word for word in _MONTHS if re.search(rf"\b{word}\b", cleaned)), None)
        numbers = [int(number) for number in re.findall(r"\d+", cleaned)]
        if month_word and numbers:
            month, year = _MONTHS[month_word], numbers[-1]
        elif cleaned.startswith("tháng") and len(numbers) >= 2:
            month, year = numbers[0], numbers[-1]
        elif len(numbers) == 2:
            month, year = numbers
        elif len(numbers) == 1:
            year, month = numbers[0], 12 if is_end else 1
        else:
            return None
        return year * 12 + month - 1 if 1 <= month <= 12 else None

    @staticmethod
    def _total_years(intervals: list[tuple[int, int]]) -> float | None:
        if not intervals:
            return None
        merged: list[list[int]] = []
        for start, end in sorted(intervals):
            if not merged or start > merged[-1][1] + 1:
                merged.append([start, end])
            else:
                merged[-1][1] = max(merged[-1][1], end)
        return round(sum(end - start + 1 for start, end in merged) / 12, 1)

    @staticmethod
    def _parse_education(lines: list[str]) -> list[Education]:
        degree_pattern = re.compile(r"\b(bachelor|master|phd|engineer|cử nhân|thạc sĩ|tiến sĩ|kỹ sư)\b", re.IGNORECASE)
        results: list[Education] = []
        for line in lines:
            if re.match(r"^(?:english|tiếng anh)\b", line, re.IGNORECASE):
                continue
            major_match = re.match(r"^major\s*:\s*(.+)$", line, re.IGNORECASE)
            if major_match and results:
                results[-1] = results[-1].model_copy(update={"major": major_match.group(1)})
                continue
            if re.match(r"^(?:current\s+)?gpa\s*:", line, re.IGNORECASE):
                continue
            date_match, degree_match = _DATE_RANGE.search(line), degree_pattern.search(line)
            results.append(Education(
                school=line if not degree_match else None, degree=degree_match.group(0) if degree_match else None,
                startDate=date_match.group("start") if date_match else None,
                endDate=date_match.group("end") if date_match else None,
                evidence=line, confidence=0.7, sourceSection="education",
            ))
        return results

    @staticmethod
    def _parse_certifications(lines: list[str]) -> list[Certification]:
        results: list[Certification] = []
        buffer: list[str] = []
        for line in lines:
            buffer.append(line.rstrip(" -"))
            if "coursera" not in line.casefold():
                continue
            name_parts = buffer[:-1]
            issuer = buffer[-1]
            if issuer.strip().casefold() == "(coursera)" and name_parts:
                previous = name_parts.pop()
                split = re.split(r"\s+[-–—]\s+", previous, maxsplit=1)
                if len(split) == 2:
                    name_parts.append(split[0])
                    issuer = f"{split[1]} (Coursera)"
                else:
                    name_parts.append(previous)
            name = " ".join(name_parts).strip(" :-")
            combined = " ".join(buffer)
            results.append(Certification(
                name=name or combined,
                issuer=issuer,
                evidence=combined, confidence=0.8, sourceSection="certifications",
            ))
            buffer = []
        if buffer:
            combined = " ".join(buffer)
            results.append(Certification(name=combined, evidence=combined, confidence=0.65, sourceSection="certifications"))
        return results

    @staticmethod
    def _parse_languages(lines: list[str], line_sections: dict[str, str | None]) -> list[LanguageSkill]:
        results: dict[str, LanguageSkill] = {}
        for line in lines:
            lowered = normalize_text(line, lowercase=True)
            for alias, canonical in _LANGUAGE_NAMES.items():
                match = re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", lowered)
                if not match:
                    continue
                remainder = line[match.end():].strip(" :|-–—")
                level_match = re.search(r"\b(A1|A2|B1|B2|C1|C2|beginner|intermediate|advanced|native|fluent|basic)\b", remainder, re.IGNORECASE)
                parsed = LanguageSkill(
                    name=canonical, level=level_match.group(0).upper() if level_match else None,
                    evidence=line, confidence=0.95 if level_match else 0.8,
                    sourceSection=line_sections.get(line),
                )
                current = results.get(canonical)
                if current is None or parsed.confidence > current.confidence:
                    results[canonical] = parsed
        return list(results.values())

    @staticmethod
    def _confidence(candidate: StructuredCandidate, sections: dict[str, list[str]]) -> float:
        score = 0.25 if candidate.full_name else 0
        score += 0.15 if candidate.email or candidate.phone else 0
        score += 0.2 if len(sections) >= 2 else (0.1 if sections else 0)
        score += 0.2 if candidate.skills else 0
        score += 0.2 if candidate.work_experience or candidate.education or candidate.certifications or candidate.languages else 0
        return round(min(score, 1.0), 2)
