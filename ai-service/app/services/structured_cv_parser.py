from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from app.schemas.cv import Certification, Education, LanguageSkill, ParsedSkill, Project, StructuredCandidate, WorkExperience
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
    rf"(?P<start>{_DATE_VALUE})\s*(?:-|–|—|to|đến|\s+)\s*"
    rf"(?P<end>{_DATE_VALUE}|present|current|now|nay|hiện tại|hiện nay)", re.IGNORECASE,
)
_HEADINGS = {
    "summary": {"summary", "profile", "about me", "about", "overview", "introduction", "professional summary", "career summary", "career profile", "giới thiệu", "tóm tắt", "career objective", "objective", "mục tiêu nghề nghiệp"},
    "skills": {"skills", "skill", "technical skills", "core technical skills", "tech skills", "technical expertise", "computer skills", "soft skills", "core skills", "software skills", "competencies", "key skills", "specialties", "professional skills", "area of expertise", "kỹ năng", "kỹ năng chuyên môn", "kỹ năng mềm", "tin học", "lĩnh vực chuyên môn", "năng lực", "chuyên môn"},
    "experience": {"experience", "experiences", "exp", "exp.", "work experience", "work experiences", "work exp", "professional experience", "professional experiences", "employment", "employment history", "career history", "career", "professional activities", "teaching experience", "work history", "hoạt động nghề nghiệp", "kinh nghiệm", "kinh nghiệm làm việc", "kinh nghiệm giảng dạy", "kinh nghiệm chuyên môn", "quá trình làm việc"},
    "activities": {"activities", "activity", "extracurricular activities", "volunteer experience", "volunteering", "leadership", "hoạt động", "hoạt động ngoại khóa", "tình nguyện"},
    "education": {"education", "edu", "educ", "educ.", "academic", "aca", "acad", "acad.", "academic background", "academic information", "qualifications", "academic qualifications", "training", "courses", "học vấn", "giáo dục", "trình độ học vấn", "đào tạo", "khóa học"},
    "certifications": {"certificate", "cert", "cert.", "certificates", "certifications", "licenses", "credentials", "chứng chỉ", "chứng nhận", "bằng cấp"},
    "awards": {"awards", "award", "honors", "honours", "achievements", "awards & achievements", "thành tựu", "giải thưởng", "thành tích"},
    "interests": {"interests", "interest", "hobbies", "hobby", "sở thích", "đam mê"},
    "references": {"references", "referees", "professional references", "người tham khảo", "tham khảo"},
    "languages": {"languages", "language", "lang", "lang.", "foreign languages", "ngôn ngữ", "ngoại ngữ"},
    "projects": {"projects", "project", "proj", "proj.", "selected projects", "academic projects", "personal projects", "notable side projects", "side projects", "highlight projects", "personal project", "dự án", "dự án cá nhân", "các dự án"},
    "contact": {"contact", "contacts", "contact information", "personal information", "info", "thông tin", "liên hệ", "thông tin liên hệ"},
}
_DOCUMENT_TITLE_WORDS = {
    "cv", "resume", "curriculum vitae", "curriculum vitaе", "professional resume",
    "personal profile", "career profile", "portfolio", "profile", "bio",
}
_ROLE_ONLY_WORDS = {
    "architect", "developer", "designer", "engineer", "student", "intern",
    "manager", "consultant", "analyst", "recruiter", "accountant",
}
_ROLE_SIGNAL = re.compile(
    r"\b(?:developer|engineer|manager|architect|designer|analyst|consultant|intern|specialist|"
    r"executive|lead|officer|coordinator|supervisor|representative|recruiter|accountant|"
    r"administrator|director|teacher|lecturer|nurse|doctor|pharmacist|technician|operator|"
    r"cashier|sales|marketing|hr|human resources|giám đốc|trưởng|quản lý|nhân viên|"
    r"chuyên viên|điều phối|giám sát|kế toán|giáo viên|giảng viên|y tá|bác sĩ|dược sĩ|"
    r"kỹ thuật viên|thu ngân|tư vấn viên|thực tập)\b",
    re.IGNORECASE,
)
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
    "prisma": {"prisma"}, "nestjs": {"nestjs", "nest.js"}, "next.js": {"next.js", "nextjs"},
    "react native": {"react native", "react-native"}, "html": {"html"}, "css": {"css"},
    "spring boot": {"spring boot"}, "rabbitmq": {"rabbitmq", "rabbit mq"},
    "bullmq": {"bullmq", "bull mq"}, "socket.io": {"socket.io", "socket io"},
    "sse": {"sse", "server-sent events"}, "livekit": {"livekit"}, "typescript": {"typescript"},
    "aws": {"aws", "amazon web services"}, "github actions": {"github actions"},
    "ci/cd": {"ci/cd", "ci cd", "continuous integration"},
    "postman": {"postman"}, "nginx": {"nginx"}, "fastapi": {"fastapi"},
    "machine learning": {"machine learning"}, "communication": {"communication"},
    "microsoft excel": {"microsoft excel", "excel"},
    "angular": {"angular", "angular.js"}, "primeng": {"primeng"}, "material ui": {"material ui", "material design"},
    "scss": {"scss"}, "aws lambda": {"aws lambda"}, "aws dynamodb": {"aws dynamodb", "dynamodb"},
    "aws ecs": {"aws ecs", "ecs"}, "gitlab ci/cd": {"gitlab ci/cd", "gitlab ci"},
    "jenkins": {"jenkins"}, "sonarqube": {"sonarqube"}, "blackduck": {"blackduck", "black duck"},
    "xunit": {"xunit"}, "jest": {"jest"}, "kafka": {"kafka", "apache kafka"},
    "oauth 2.0": {"oauth 2.0", "oauth2"}, "jwt": {"jwt"}, "mqtt": {"mqtt"},
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
    def parse(self, raw_text: str, job_skills: list[str] | None = None, blocks: list[DocumentBlock] | None = None, *, layout: str | None = None, ocr_applied: bool = False) -> StructuredCandidate:
        return self.parse_with_diagnostics(raw_text, job_skills, blocks, layout=layout, ocr_applied=ocr_applied).candidate

    def parse_with_diagnostics(self, raw_text: str, job_skills: list[str] | None = None, blocks: list[DocumentBlock] | None = None, *, layout: str | None = None, ocr_applied: bool = False) -> StructuredParseResult:
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
            activities=self._parse_text_items(sections.get("activities", [])),
            awards=self._parse_text_items(sections.get("awards", [])),
            interests=self._parse_text_items(sections.get("interests", [])),
            references=self._parse_text_items(sections.get("references", [])),
            sideProjects=self._parse_side_projects(sections.get("projects", [])),
            projects=self._parse_projects(lines, sections.get("projects", [])),
        )
        warnings: list[str] = []
        if full_name is None:
            warnings.append("FULL_NAME_LOW_CONFIDENCE")
        if not sections:
            warnings.append("NO_SECTIONS_DETECTED")
        if "experience" in sections and sections["experience"] and not experience:
            warnings.extend(["EXPERIENCE_DATE_NOT_DETECTED", "EXPERIENCE_EVIDENCE_UNRESOLVED"])
        if layout == "UNSTRUCTURED" and ocr_applied:
            warnings.append("OCR_LAYOUT_UNSTRUCTURED")
        if ocr_applied and not blocks:
            warnings.append("OCR_POSITION_DATA_UNAVAILABLE")
        confidence = self._confidence(candidate, sections)
        if "EXPERIENCE_EVIDENCE_UNRESOLVED" in warnings:
            confidence = min(confidence, 0.55)
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
            if heading and current == "experience" and cls._is_experience_subheading(line, heading[0]):
                heading = None
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

    @staticmethod
    def _is_experience_subheading(line: str, section: str) -> bool:
        """Keep repeated role-level labels inside an experience timeline."""
        cleaned = normalize_text(line, lowercase=True)
        return section == "awards" and cleaned in {
            "achievement", "achievements", "key achievements", "thành tựu đạt được",
        }

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
            if lowered in _DOCUMENT_TITLE_WORDS or lowered in _ROLE_ONLY_WORDS:
                continue
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
        aliases.update({
            "revit": {"revit"}, "photoshop": {"photoshop"}, "enscape": {"enscape"},
            "autocad": {"autocad", "auto cad"}, "sketchup": {"sketchup", "sketch up"},
            "d5 render": {"d5 render", "d5 renderer"}, "teamwork": {"team work", "teamwork"},
        })
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
                skill_match = re.search(rf"(?<!\w){re.escape(matched)}(?!\w)", lowered, re.IGNORECASE)
                trailing = line[skill_match.end():] if skill_match else line
                trailing = re.split(r"[,;|]", trailing, maxsplit=1)[0]
                years_match = re.search(r"(?:\(|\b)(\d+(?:[.,]\d+)?)\s*\+?\s*(?:years?|yrs?|năm)", trailing, re.IGNORECASE)
                years = float(years_match.group(1).replace(",", ".")) if years_match else None
                score_match = re.search(r"(\d{1,3})\s*%", trailing)
                star_match = re.search(r"([★☆*]{2,5})", trailing)
                score = min(float(score_match.group(1)), 100) if score_match else None
                if star_match:
                    score = round(star_match.group(1).count("★") / len(star_match.group(1)) * 100, 1)
                results[canonical] = ParsedSkill(name=canonical, yearsOfExperience=years, selfReportedScore=score, evidence=line, confidence=0.95 if source == "skills" else 0.8, sourceSection=source)
                break
        return sorted(results.values(), key=lambda item: item.name)

    @staticmethod
    def _positive_phrase(text: str, phrase: str) -> bool:
        pattern = re.compile(rf"(?<!\w){re.escape(phrase)}(?!\w)", re.IGNORECASE)
        negative = re.compile(r"(?:without|no|not|lacks?|missing|không\s+có|chưa\s+có|thiếu)\s+$", re.IGNORECASE)
        return any(not negative.search(text[max(0, match.start() - 24):match.start()]) for match in pattern.finditer(text))

    def _parse_experience(self, lines: list[str]) -> tuple[list[WorkExperience], list[tuple[int, int]]]:
        """Parse employer records without turning project periods into jobs.

        CV text extraction order is not always visual order, especially for
        two-column PDFs. Keep an employer context (company + role) and attach
        ``Project:`` lines to it. Project dates never count as employment time.
        """
        results: list[WorkExperience] = []
        intervals: list[tuple[int, int]] = []
        employers: list[dict[str, object]] = []
        current: dict[str, object] | None = None

        def add_employer(entry: dict[str, object]) -> None:
            start, end = entry["start"], entry["end"]
            assert isinstance(start, str) and isinstance(end, str)
            start_index = self._month_index(start, is_end=False)
            end_index = self._month_index(end, is_end=True)
            if start_index is not None and end_index is not None and end_index >= start_index:
                intervals.append((start_index, end_index))
                results.append(WorkExperience(
                    company=entry["company"],
                    position=entry["position"],
                    startDate=start,
                    endDate=end,
                    description=entry["evidence"],
                    projects=entry["projects"],
                    evidence=entry["evidence"],
                    confidence=0.9,
                    sourceSection="experience",
                ))

        index = 0
        while index < len(lines):
            line = lines[index]
            # Common CV timeline templates keep the date in a separate rail.
            # Reconstruct only the three bounded, visually adjacent patterns;
            # do not infer an employer from a role/date pair alone.
            entry, consumed = self._experience_entry_at(lines, index)
            if entry is not None:
                employers.append(entry)
                current = entry
                index += consumed
                continue
            if self._is_project_line(line):
                project = self._project_from_line(line, source_section="experience")
                if current is not None and project is not None:
                    current["projects"].append(project)
                index += 1
                continue
            if self._is_technology_line(line):
                if current is not None and current["projects"]:
                    technologies = self._technologies_from_line(line)
                    if technologies:
                        project = current["projects"][-1]
                        current["projects"][-1] = project.model_copy(update={"technologies": technologies})
                index += 1
                continue
            if self._looks_like_employer(lines, index):
                current = {
                    "company": line,
                    "position": lines[index + 1],
                    "start": None,
                    "end": None,
                    "evidence": f"{line} | {lines[index + 1]}",
                    "projects": [],
                }
                employers.append(current)
                index += 2
                continue
            if (
                index + 1 < len(lines)
                and not _DATE_RANGE.search(line)
                and not self._is_project_line(lines[index + 1])
                and (not _DATE_RANGE.search(lines[index + 1]) or "|" in line)
            ):
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
            if current is not None:
                undated = [entry for entry in employers if entry.get("start") is None]
                target = undated[-1] if undated else current
                if (
                    current.get("start") is None
                    and len(undated) > 1
                    and self._projects_end_before(current["projects"], start)
                ):
                    target = undated[-2]
                target["start"] = match.group("start")
                target["end"] = match.group("end")
                target["evidence"] = f"{target['evidence']} | {line}"
                current = target
                index += 1
                continue
            identity = line[:match.start()].strip(" ,-–—")
            parts = [part.strip() for part in identity.split("|", maxsplit=1)]
            # Preserve the established one-line pipe format, but avoid turning
            # an isolated role plus dates into a fictional company record.
            if len(parts) == 2 and parts[0] and parts[1]:
                inline = {
                    "company": parts[0],
                    "position": parts[1],
                    "start": match.group("start"),
                    "end": match.group("end"),
                    "evidence": line,
                    "projects": [],
                }
                add_employer(inline)
            elif "|" in line and identity:
                inline = {
                    "company": identity,
                    "position": None,
                    "start": match.group("start"),
                    "end": match.group("end"),
                    "evidence": line,
                    "projects": [],
                }
                add_employer(inline)
            index += 1
        for employer in employers:
            if employer.get("start") is not None and employer.get("end") is not None:
                add_employer(employer)
        return results, intervals

    @classmethod
    def _experience_entry_at(cls, lines: list[str], index: int) -> tuple[dict[str, object] | None, int]:
        """Build a record only when company, role and date are locally evidenced."""
        if index + 1 >= len(lines):
            return None, 0
        first, second = lines[index:index + 2]
        date_match = _DATE_RANGE.search(first)
        inline_role = first[:date_match.start()].strip(" /|-–—") if date_match else ""
        if date_match and inline_role and cls._is_role_line(inline_role) and cls._is_company_line(second):
            return cls._experience_entry(second, inline_role, date_match, f"{first} | {second}"), 2
        if index + 2 >= len(lines):
            return None, 0
        third = lines[index + 2]
        date_match = _DATE_RANGE.search(second)
        if date_match and not cls._is_project_line(third) and cls._is_company_line(first) and cls._is_role_line(third):
            return cls._experience_entry(first, third, date_match, f"{first} | {second} | {third}"), 3
        if date_match and not cls._is_project_line(third) and cls._is_role_line(first) and cls._is_company_line(third):
            return cls._experience_entry(third, first, date_match, f"{first} | {second} | {third}"), 3

        date_match = _DATE_RANGE.search(first)
        if date_match and cls._is_company_line(second) and cls._is_role_line(third):
            return cls._experience_entry(second, third, date_match, f"{first} | {second} | {third}"), 3

        date_match = _DATE_RANGE.search(third)
        if date_match and not cls._is_project_line(third) and cls._is_company_line(first) and cls._is_role_line(second):
            return cls._experience_entry(first, second, date_match, f"{first} | {second} | {third}"), 3
        return None, 0

    @staticmethod
    def _experience_entry(company: str, position: str, date_match: re.Match[str], evidence: str) -> dict[str, object]:
        return {
            "company": company,
            "position": position,
            "start": date_match.group("start"),
            "end": date_match.group("end"),
            "evidence": evidence,
            "projects": [],
        }

    @classmethod
    def _is_role_line(cls, line: str) -> bool:
        if _DATE_RANGE.search(line) or cls._heading_match(line):
            return False
        if len(line) > 96 or len(line.split()) > 10 or not re.search(r"[A-Za-zÀ-ỹ]", line):
            return False
        return bool(_ROLE_SIGNAL.search(line))

    @classmethod
    def _is_company_line(cls, line: str) -> bool:
        if _DATE_RANGE.search(line) or cls._heading_match(line) or cls._is_project_line(line) or cls._is_technology_line(line):
            return False
        if any(marker in line for marker in (":", "|", ";")) or line.rstrip().endswith(".") or len(line) > 96 or len(line.split()) > 10:
            return False
        return bool(re.search(r"[A-Za-zÀ-ỹ]", line)) and not cls._is_role_line(line)

    @staticmethod
    def _is_project_line(line: str) -> bool:
        return bool(re.match(r"^(?:project|side project|personal project|dự án)\s*:", line, re.IGNORECASE))

    @staticmethod
    def _is_technology_line(line: str) -> bool:
        return bool(re.match(r"^(?:technologies|technology|tech stack|stack|công nghệ)\s*:", line, re.IGNORECASE))

    @classmethod
    def _looks_like_employer(cls, lines: list[str], index: int) -> bool:
        if index + 1 >= len(lines):
            return False
        company, position = lines[index], lines[index + 1]
        return cls._is_company_line(company) and cls._is_role_line(position)

    @classmethod
    def _project_from_line(cls, line: str, *, source_section: str) -> Project | None:
        prefix = re.match(r"^(?:project|side project|personal project|dự án)\s*:\s*", line, re.IGNORECASE)
        if prefix is None:
            return None
        name_and_dates = line[prefix.end():]
        match = _DATE_RANGE.search(name_and_dates)
        name = name_and_dates[:match.start()].strip(" |-–—") if match else name_and_dates.strip()
        if not name:
            return None
        return Project(
            name=name,
            startDate=match.group("start") if match else None,
            endDate=match.group("end") if match else None,
            evidence=line,
            confidence=0.9,
            sourceSection=source_section,
        )

    @staticmethod
    def _technologies_from_line(line: str) -> list[str]:
        value = line.split(":", maxsplit=1)[-1]
        return [item.strip() for item in re.split(r"[,|]", value) if item.strip()]

    def _projects_end_before(self, projects: object, start_index: int) -> bool:
        if not isinstance(projects, list) or not projects:
            return False
        end_indexes = [
            self._month_index(project.end_date, is_end=True)
            for project in projects
            if isinstance(project, Project) and project.end_date
        ]
        return bool(end_indexes) and all(end is not None and end < start_index for end in end_indexes)

    @staticmethod
    def _month_index(value: str, *, is_end: bool) -> int | None:
        cleaned = normalize_text(value, lowercase=True).replace(".", "")
        if cleaned in {"present", "current", "now", "nay", "hiện tại", "hiện nay"}:
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
        institution_pattern = re.compile(r"\b(university|college|school|academy|đại học|cao đẳng|trường)\b", re.IGNORECASE)
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
            if not date_match and not degree_match and not institution_pattern.search(line):
                continue
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
    def _parse_text_items(lines: list[str]) -> list[str]:
        """Preserve supplementary CV sections without inventing structure."""
        return list(dict.fromkeys(line.strip(" -•") for line in lines if line.strip(" -•")))

    @classmethod
    def _parse_projects(cls, lines: list[str], project_section: list[str]) -> list[str]:
        evidence = list(project_section)
        evidence.extend(
            line for line in lines
            if re.match(r"^(?:project|side project|personal project)\s*:", line, re.IGNORECASE)
        )
        return cls._parse_text_items(evidence)

    @classmethod
    def _parse_side_projects(cls, project_section: list[str]) -> list[Project]:
        """Return standalone projects as records while retaining legacy strings."""
        results: list[Project] = []
        for line in project_section:
            project = cls._project_from_line(line, source_section="projects")
            if project is None:
                pieces = re.split(r"\s+[–—-]\s+", line, maxsplit=1)
                if len(pieces) != 2:
                    continue
                name, description = pieces
                if not name.strip() or _DATE_RANGE.search(line):
                    continue
                project = Project(
                    name=name.strip(),
                    description=description.strip() if description else None,
                    evidence=line,
                    confidence=0.75,
                    sourceSection="projects",
                )
            results.append(project)
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
