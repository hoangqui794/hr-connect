from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from app.schemas.cv import Certification, Education, LanguageSkill, ParsedSkill, Project, StructuredCandidate, WorkExperience
from app.services.cv_structure import CvSectionRouter
from app.services.document_parser import DocumentBlock
from app.services.hybrid_cv_parser import ExperienceResolver, HybridExperienceParser
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
_DATE_VALUE = rf"(?:0?[1-9]|1[0-2])[/.-]\d{{4}}|(?:19|20)\d{{2}}|(?:(?:early|mid|late|đầu|giữa|cuối)\s+)?(?:{_MONTH_WORD})\.?\s+\d{{4}}|tháng\s+(?:0?[1-9]|1[0-2])[/.-]\d{{4}}"
_DATE_RANGE = re.compile(
    rf"(?P<start>{_DATE_VALUE})\s*(?:-|–|—|to|đến|\s+)\s*"
    rf"(?P<end>{_DATE_VALUE}|present|current|now|nay|hiện tại|hiện nay)", re.IGNORECASE,
)
_HEADINGS = {
    "summary": {"summary", "profile", "about me", "about", "overview", "introduction", "professional summary", "career summary", "career profile", "giới thiệu", "tóm tắt", "career objective", "objective", "mục tiêu nghề nghiệp"},
    "skills": {"skills", "skill", "technical skills", "core technical skills", "tech skills", "technical expertise", "computer skills", "soft skills", "core skills", "software skills", "competencies", "key skills", "specialties", "professional skills", "area of expertise", "kỹ năng", "kỹ năng chuyên môn", "kỹ năng mềm", "tin học", "lĩnh vực chuyên môn", "năng lực", "chuyên môn"},
    "experience": {"experience", "experiences", "exp", "exp.", "work experience", "work experiences", "working experience", "working experiences", "work exp", "professional experience", "professional experiences", "employment", "employment history", "career history", "career", "professional activities", "teaching experience", "work history", "working history", "hoạt động nghề nghiệp", "kinh nghiệm", "kinh nghiệm làm việc", "kinh nghiệm giảng dạy", "kinh nghiệm chuyên môn", "quá trình làm việc"},
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
    r"cashier|sales|marketing|planner|advisor|associate|trainee|consultant|hr|human resources|giám đốc|trưởng|quản lý|nhân viên|"
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
    "express": {"express", "express.js"}, "fastify": {"fastify"},
    "graphql": {"graphql"}, "trpc": {"trpc", "t rpc"},
    "drizzle": {"drizzle", "drizzle orm"}, "sentry": {"sentry"},
    "elasticsearch": {"elasticsearch", "elastic search"}, "opensearch": {"opensearch", "open search"},
    "firebase": {"firebase"}, "redux": {"redux"},
    "redux toolkit": {"redux toolkit"}, "redux saga": {"redux saga"},
    "zustand": {"zustand"}, "react query": {"react query"},
    "react hook form": {"react hook form", "react-hook-form"},
    "tailwind css": {"tailwind", "tailwind css"}, "shadcn": {"shadcn", "shadcn/ui"},
    "styled-components": {"styled-components", "styled components"}, "i18next": {"i18next"},
    "vite": {"vite"}, "remix": {"remix"}, "astro": {"astro"},
    "vercel": {"vercel"}, "fly.io": {"fly.io", "fly io"},
    "github actions": {"github actions", "github workflows"}, "nx": {"nx"},
    "linux": {"linux"}, "rust": {"rust"}, "hibernate": {"hibernate"},
    "unity editor": {"unity editor"}, "unreal engine": {"unreal engine"},
    "ar foundation": {"ar foundation"}, "cesium": {"cesium", "cesiumjs"},
    "unity assets": {"unity assets"}, "visual studio": {"visual studio"},
    "github": {"github"}, "robotstudio": {"robotstudio", "robot studio"},
    "solidworks": {"solidworks", "solid works"}, "opencv": {"opencv", "open cv"},
    "matlab": {"matlab"}, "arduino": {"arduino"}, "vivox": {"vivox"},
    "three.js": {"three.js", "threejs"}, "turf.js": {"turf.js", "turfjs"},
    "axios": {"axios"},
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
        lines = [
            line.strip(" \t•●*-|\u200b")
            for line in raw_text.splitlines()
            if line.strip(" \t•●*-|\u200b")
        ]
        routed_sections = CvSectionRouter.route(lines, blocks, self._heading_match)
        sections, line_sections = routed_sections.sections, routed_sections.line_sections
        email_match, phone_match = _EMAIL.search(text), _PHONE.search(text)
        sequential_experience, _ = self._parse_experience(sections.get("experience", []))
        hybrid_experience, layout_classification = HybridExperienceParser().extract(
            sections.get("experience", []), blocks, layout, ocr_applied
        )
        resolved_experience = ExperienceResolver.resolve(sequential_experience, hybrid_experience)
        experience = resolved_experience.records
        intervals = self._experience_intervals(experience)
        full_name = self._find_name(lines, blocks or [])
        candidate = StructuredCandidate(
            fullName=full_name,
            email=email_match.group(0) if email_match else None,
            phone=self._normalize_phone(phone_match.group(0)) if phone_match else None,
            summary=self._join_summary_lines(sections.get("summary", [])) or self._summary_from_profile_lines(lines, blocks or []),
            totalYearsOfExperience=self._total_years(intervals),
            skills=self._parse_skills(lines, line_sections, job_skills or [], sections.get("skills", [])),
            education=self._parse_education(sections.get("education", [])),
            certifications=self._parse_certifications(sections.get("certifications", [])),
            workExperience=experience,
            languages=self._parse_languages(lines, line_sections),
            activities=self._parse_text_items(sections.get("activities", [])),
            awards=self._parse_awards(sections.get("awards", [])),
            interests=self._parse_text_items(sections.get("interests", [])),
            references=self._parse_text_items(sections.get("references", [])),
            sideProjects=self._parse_side_projects(sections.get("projects", [])),
            projects=self._parse_projects(lines, sections.get("projects", [])),
        )
        warnings: list[str] = [
            *layout_classification.diagnostics,
            *resolved_experience.warnings,
        ]
        if full_name is None:
            warnings.append("FULL_NAME_LOW_CONFIDENCE")
        if not sections:
            warnings.append("NO_SECTIONS_DETECTED")
        if "experience" in sections and sections["experience"] and not experience:
            warnings.extend(["EXPERIENCE_DATE_NOT_DETECTED", "EXPERIENCE_EVIDENCE_UNRESOLVED"])
        if any(item.company is None and item.position and item.start_date and item.end_date for item in experience):
            warnings.append("EMPLOYER_NOT_STATED")
        if layout == "UNSTRUCTURED" and ocr_applied:
            warnings.append("OCR_LAYOUT_UNSTRUCTURED")
        if ocr_applied and not blocks:
            warnings.append("OCR_POSITION_DATA_UNAVAILABLE")
        if any(not project.description for item in experience for project in item.projects):
            warnings.append("PROJECT_DESCRIPTION_MISSING")
        confidence = min(self._confidence(candidate, sections), 0.95)
        if "PROJECT_DESCRIPTION_MISSING" in warnings:
            confidence = min(confidence, 0.75)
        if "EXPERIENCE_EVIDENCE_UNRESOLVED" in warnings:
            confidence = min(confidence, 0.55)
        return StructuredParseResult(candidate, confidence, confidence < 0.6 or bool(warnings), warnings)

    def _experience_intervals(self, experience: list[WorkExperience]) -> list[tuple[int, int]]:
        intervals: list[tuple[int, int]] = []
        for item in experience:
            if not item.start_date or not item.end_date:
                continue
            start = self._month_index(item.start_date, is_end=False)
            end = self._month_index(item.end_date, is_end=True)
            if start is not None and end is not None and end >= start:
                intervals.append((start, end))
        return intervals

    @classmethod
    def _summary_from_profile_lines(cls, lines: list[str], blocks: list[DocumentBlock]) -> str | None:
        """Recover a self-description even when a two-column PDF reorders text."""
        profile_signal = re.compile(
            r"\b(?:passionate|motivated|results-driven|experienced|professional|enthusiast|driven|"
            r"seeking|aspiring|developer|engineer|student|candidate|tôi|mong muốn|định hướng)\b",
            re.IGNORECASE,
        )
        block_summary = cls._summary_from_profile_blocks(blocks, profile_signal)
        if block_summary:
            return block_summary
        for index, line in enumerate(lines):
            if (
                len(line) < 35
                or not profile_signal.search(line)
                or cls._heading_match(line)
                or cls._is_project_line(line)
                or _EMAIL.search(line)
                or _PHONE.search(line)
                or re.match(r"^(?:responsibilities|tech stack|technologies)\s*:", line, re.IGNORECASE)
            ):
                continue
            parts = [line]
            for continuation in lines[index + 1:index + 3]:
                if (
                    _EMAIL.search(continuation)
                    or _PHONE.search(continuation)
                    or cls._heading_match(continuation)
                    or cls._is_project_line(continuation)
                    or re.match(r"^(?:responsibilities|tech stack|technologies)\s*:", continuation, re.IGNORECASE)
                ):
                    break
                if len(continuation) >= 3:
                    parts.append(continuation)
                if continuation.rstrip().endswith((".", "!", "?")):
                    break
            value = " ".join(parts).strip()
            if len(value) >= 50:
                return value
        return None

    @classmethod
    def _summary_from_profile_blocks(
        cls,
        blocks: list[DocumentBlock],
        profile_signal: re.Pattern[str],
    ) -> str | None:
        """Use visual adjacency for a header summary split across PDF blocks."""
        ordered = sorted(blocks, key=lambda item: (item.page, item.bbox[1], item.bbox[0]))
        for index, block in enumerate(ordered):
            line = block.text.strip()
            if (
                len(line) < 35
                or not profile_signal.search(line)
                or cls._heading_match(line)
                or cls._is_project_line(line)
                or _EMAIL.search(line)
                or _PHONE.search(line)
            ):
                continue
            parts = [line]
            for continuation in ordered[index + 1:index + 4]:
                candidate = continuation.text.strip()
                if continuation.page != block.page or continuation.bbox[1] - block.bbox[3] > 40:
                    break
                if abs(continuation.bbox[0] - block.bbox[0]) > 36:
                    continue
                if (
                    not candidate
                    or cls._heading_match(candidate)
                    or cls._is_project_line(candidate)
                    or _EMAIL.search(candidate)
                    or _PHONE.search(candidate)
                ):
                    break
                parts.append(candidate)
                if candidate.rstrip().endswith((".", "!", "?")):
                    break
            value = " ".join(parts).strip()
            if len(value) >= 50:
                return value
        return None

    @classmethod
    def _join_summary_lines(cls, lines: list[str]) -> str | None:
        """Repair a short visual tail that a PDF text layer emitted too early."""
        repaired: list[str] = []
        for line in lines:
            if cls._is_summary_boundary(line):
                break
            repaired.append(line)
        for index in range(1, len(repaired) - 1):
            previous, current, following = repaired[index - 1:index + 2]
            if (
                len(current.split()) <= 8
                and current.rstrip().endswith((".", "!", "?"))
                and following[:1].islower()
                and (previous.casefold().endswith((" in", " with", " for", " like", " to"))
                     or following.casefold().rstrip(".").endswith(" like"))
            ):
                repaired[index], repaired[index + 1] = following, current
        value = " ".join(repaired).strip()
        return value or None

    @classmethod
    def _is_summary_boundary(cls, line: str) -> bool:
        """Keep a profile from consuming a later labeled CV section."""
        if cls._heading_match(line) is not None:
            return True
        normalized = normalize_text(line, lowercase=True).strip(" :")
        return bool(re.fullmatch(
            r"(?:(?:key|selected|career|professional)\s+)?"
            r"(?:achievements?|highlights?|accomplishments?|thành tựu|thành tích)",
            normalized,
        ))

    @classmethod
    def _heading_match(cls, line: str) -> tuple[str, str] | None:
        cleaned = re.sub(r"[:\s]+$", "", normalize_text(line, lowercase=True))
        for section, headings in _HEADINGS.items():
            for heading in sorted(headings, key=len, reverse=True):
                if cleaned == heading:
                    return section, ""
                if cleaned.startswith(heading + " "):
                    remainder = line[len(heading):].strip(" :-")
                    if section == "projects" and remainder.startswith("|"):
                        continue
                    if section == "certifications" and re.fullmatch(
                        r"(?:&|and)\s+(?:short\s+)?(?:courses?|training)",
                        normalize_text(remainder, lowercase=True),
                    ):
                        remainder = ""
                    if section == "awards" and re.fullmatch(
                        r"(?:&|and)\s+(?:awards?|achievements?)",
                        normalize_text(remainder, lowercase=True),
                    ):
                        remainder = ""
                    return section, remainder
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
        labelled_name = cls._name_from_label_blocks(blocks)
        if labelled_name:
            return labelled_name
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
            if any(token in lowered for token in ("http", "www.", "objective", "developer", "engineer", "student", "university", "experience", "details", "information")):
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
    def _name_from_label_blocks(blocks: list[DocumentBlock]) -> str | None:
        """Prefer a visual value beside a recognised name label over a heading."""
        labels = {"name", "full name", "họ tên", "họ và tên"}
        for label in blocks:
            label_text = normalize_text(label.text, lowercase=True).strip(" :")
            if label_text not in labels:
                continue
            for candidate in blocks:
                if candidate.page != label.page or candidate.bbox[0] < label.bbox[2] - 4:
                    continue
                label_center = (label.bbox[1] + label.bbox[3]) / 2
                candidate_center = (candidate.bbox[1] + candidate.bbox[3]) / 2
                value = normalize_text(candidate.text)
                if (
                    abs(label_center - candidate_center) <= 14
                    and 2 <= len(value.split()) <= 6
                    and len(value) <= 60
                    and not any(character.isdigit() for character in value)
                    and sum(character.isalpha() for character in value) >= 4
                ):
                    return value
        return None

    @staticmethod
    def _normalize_phone(value: str) -> str:
        prefix = "+" if value.strip().startswith("+") else ""
        return prefix + re.sub(r"\D", "", value)

    def _parse_skills(
        self,
        lines: list[str],
        line_sections: dict[str, str | None],
        job_skills: list[str],
        declared_skill_lines: list[str],
    ) -> list[ParsedSkill]:
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
                matched = next((
                    variant for variant in sorted(variants, key=len, reverse=True)
                    if self._contains_skill_variant(lowered, variant, aliases)
                    and self._positive_phrase(lowered, variant)
                ), None)
                if matched is None:
                    continue
                source = line_sections.get(line)
                if (
                    canonical == "communication"
                    and source != "skills"
                    and not re.search(r"\bcommunication\s+skills?\b", lowered, re.IGNORECASE)
                ):
                    continue
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
        for line in self._merge_wrapped_skill_lines(declared_skill_lines):
            for value in self._declared_skill_values(line):
                key = self._canonical_declared_skill(value, aliases)
                results.setdefault(
                    key,
                    ParsedSkill(
                        name=key,
                        evidence=line,
                        confidence=0.86,
                        sourceSection="skills",
                    ),
                )
        return sorted(results.values(), key=lambda item: item.name)

    @staticmethod
    def _contains_skill_variant(text: str, variant: str, aliases: dict[str, set[str]]) -> bool:
        """Match a skill token without also emitting its longer registered tool."""
        longer_variants = {
            normalized[len(variant):].strip()
            for candidates in aliases.values()
            for candidate in candidates
            for normalized in [normalize_text(candidate, lowercase=True)]
            if normalized.startswith(f"{variant} ")
        }
        for match in re.finditer(rf"(?<!\w){re.escape(variant)}(?!\w)", text):
            tail = text[match.end():].lstrip()
            if not any(tail.startswith(suffix) for suffix in longer_variants):
                return True
        return False

    @staticmethod
    def _canonical_declared_skill(value: str, aliases: dict[str, set[str]]) -> str:
        """Use one identity for spelling variants, while preserving distinct tools."""
        normalized = normalize_text(value, lowercase=True)
        normalized = re.sub(r"\s*\((?:expert|advanced|intermediate|beginner)\)?$", "", normalized)
        normalized = re.sub(r"\s+\d+(?:[.\d/–-]*\d)?$", "", normalized)
        for canonical, variants in aliases.items():
            if normalized == canonical or normalized in {
                normalize_text(variant, lowercase=True) for variant in variants
            }:
                return canonical
        return normalize_skill_name(value)

    @staticmethod
    def _merge_wrapped_skill_lines(lines: list[str]) -> list[str]:
        """Rejoin a visual skill list when a PDF wraps inside parentheses."""
        merged: list[str] = []
        pending = ""
        for line in lines:
            value = line.strip()
            if not value:
                continue
            if pending:
                pending = f"{pending} {value}"
                if pending.count("(") <= pending.count(")"):
                    merged.append(pending)
                    pending = ""
                continue
            if value.count("(") > value.count(")"):
                pending = value
            else:
                merged.append(value)
        if pending:
            merged.append(pending)
        return merged

    @staticmethod
    def _declared_skill_values(line: str) -> list[str]:
        """Keep concise skills declared by the candidate outside a fixed taxonomy."""
        if _EMAIL.search(line) or _PHONE.search(line) or _DATE_RANGE.search(line):
            return []
        normalized_line = normalize_text(line, lowercase=True)
        if normalized_line in {
            "cloud & devops", "databases & architecture", "programming languages & frameworks",
            "specialized skills", "technical skills", "soft skills", "back-end", "front-end",
        }:
            return []
        if re.match(r"^(?:languages?|foreign languages?|ngôn ngữ|ngoại ngữ)\s*:", normalized_line):
            return []
        cleaned = re.sub(r"^[A-Za-zÀ-ỹ&/ ]{2,40}\s*:\s*", "", line).strip(" •●-–—|\t")
        results: list[str] = []
        for value in StructuredCvParser._split_top_level_values(cleaned):
            category = re.fullmatch(r"(?P<label>[^()]{2,40})\((?P<items>[^)]+)\)\.?", value.strip())
            values = [value]
            if category and re.search(
                r"\b(?:tools?|technologies|software|platforms?|frameworks?)\b",
                category.group("label"),
                re.IGNORECASE,
            ):
                values = StructuredCvParser._split_top_level_values(category.group("items"))
            for item in values:
                item = re.sub(
                    r"\s*\((?:\d+(?:[.,]\d+)?\s*(?:years?|yrs?|năm)|\d{1,3}%|[★☆*]{2,5})[^)]*\)",
                    "",
                    item,
                    flags=re.IGNORECASE,
                ).strip(" .:-–—)")
                tool_qualified = re.search(r"(?:^|\s)(?:ai\s+)?tools?\s*[-:]\s*(.+)$", item, re.IGNORECASE)
                if tool_qualified:
                    item = tool_qualified.group(1).strip(" .:-–—)")
                if (
                    not item
                    or not any(character.isalnum() for character in item)
                    or len(item) > 56
                    or len(item.split()) > 7
                    or re.search(r"\b(?:responsibilit|achievement|mô tả|kinh nghiệm|experience)\b", item, re.IGNORECASE)
                ):
                    continue
                if normalize_text(item, lowercase=True) not in _HEADINGS["skills"]:
                    results.append(item)
        return results

    @staticmethod
    def _split_top_level_values(value: str) -> list[str]:
        """Split a candidate list without breaking commas inside parentheses."""
        values: list[str] = []
        current: list[str] = []
        depth = 0
        for char in value:
            if char == "(":
                depth += 1
            elif char == ")" and depth:
                depth -= 1
            if char in ",;|•●" and depth == 0:
                item = "".join(current).strip()
                if item:
                    values.append(item)
                current = []
                continue
            current.append(char)
        item = "".join(current).strip()
        if item:
            values.append(item)
        return values

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
            project_led_entry, consumed = self._project_led_experience_at(lines, index)
            if project_led_entry is not None:
                employers.append(project_led_entry)
                current = project_led_entry
                index += consumed
                continue
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
                # A PDF may wrap a comma-separated technology list mid-item.
                # Stop at structural boundaries or prose, never consume the next job.
                while index + 1 < len(lines):
                    following = lines[index + 1]
                    if (self._is_project_line(following) or self._heading_match(following)
                        or self._experience_entry_at(lines, index + 1)[0] is not None
                        or _DATE_RANGE.search(following)
                        or len(following.split()) > 18
                        or not (line.rstrip().endswith(",")
                                or (re.search(r"\b[A-Z]{2,8}$", line) and "," in following)
                                or following.casefold() in {"architecture", "framework", "library", "services", "server", "core"})):
                        break
                    line = f"{line} {following}"
                    index += 1
                if current is not None and current["projects"]:
                    technologies = self._technologies_from_line(line)
                    if technologies:
                        project = current["projects"][-1]
                        current["projects"][-1] = project.model_copy(update={"technologies": technologies})
                index += 1
                continue
            if (current is not None and current["projects"]
                and not self._looks_like_employer(lines, index)
                and not _DATE_RANGE.search(line)):
                project = current["projects"][-1]
                assert isinstance(project, Project)
                description = " ".join(part for part in (project.description, line.strip(" •●")) if part)
                current["projects"][-1] = project.model_copy(
                    update={
                        "description": description or None,
                        "evidence": f"{project.evidence} | {line}",
                    }
                )
                current["evidence"] = f"{current['evidence']} | {line}"
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
    def _project_led_experience_at(cls, lines: list[str], index: int) -> tuple[dict[str, object] | None, int]:
        """Recognise Date--Project--Role engagements without fabricating an employer.

        Some CVs report client assignments rather than legal employers. They
        are useful work evidence only when all three facts are locally present.
        """
        window = lines[index:index + 3]
        if len(window) < 3:
            return None, 0
        date_index, date_match = next(
            ((offset, _DATE_RANGE.search(value)) for offset, value in enumerate(window) if _DATE_RANGE.search(value)),
            (None, None),
        )
        project_index, project = next(
            ((offset, cls._project_from_line(value, source_section="experience"))
            for offset, value in enumerate(window)
            if cls._is_project_line(value)),
            (None, None),
        )
        role_index, position = next(
            ((offset, cls._role_value(value)) for offset, value in enumerate(window) if cls._role_value(value)),
            (None, None),
        )
        if (
            date_index is None
            or date_match is None
            or project_index is None
            or project is None
            or role_index is None
            or position is None
            or len({date_index, project_index, role_index}) != 3
        ):
            return None, 0
        project = project.model_copy(
            update={
                "start_date": project.start_date or date_match.group("start"),
                "end_date": project.end_date or date_match.group("end"),
            }
        )
        return {
            "company": None,
            "position": position,
            "start": date_match.group("start"),
            "end": date_match.group("end"),
            "evidence": " | ".join(window),
            "projects": [project],
        }, 3

    @classmethod
    def _role_value(cls, line: str) -> str | None:
        labelled = re.match(r"^(?:role|position|title|vai trò|chức danh)\s*:\s*(?P<value>.+)$", line, re.IGNORECASE)
        value = labelled.group("value").strip() if labelled else line.strip()
        return value if cls._is_role_line(value) else None

    @classmethod
    def _experience_entry_at(cls, lines: list[str], index: int) -> tuple[dict[str, object] | None, int]:
        """Build a record only when company, role and date are locally evidenced."""
        if index + 1 >= len(lines):
            return None, 0
        first, second = lines[index:index + 2]
        if cls._is_project_line(first) or cls._is_project_line(second):
            return None, 0
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
        if any(marker in line for marker in (":", ";")) or line.rstrip().endswith(".") or len(line) > 96 or len(line.split()) > 10:
            return False
        if "|" in line:
            parts = [part.strip() for part in line.split("|") if part.strip()]
            if not (1 < len(parts) <= 3 and all(len(part.split()) <= 6 for part in parts)):
                return False
            # A business-unit suffix such as ``Company | Marketing Center`` is
            # still an employer; only the leading part decides this evidence.
            return not cls._is_role_line(parts[0])
        return bool(re.search(r"[A-Za-zÀ-ỹ]", line)) and not cls._is_role_line(line)

    @classmethod
    def _is_project_line(cls, line: str) -> bool:
        return bool(re.match(r"^(?:project|side project|personal project|dự án)\s*:", line, re.IGNORECASE)) or cls._numbered_project_name(line) is not None

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
            numbered_name = cls._numbered_project_name(line)
            if numbered_name is not None:
                return Project(
                    name=numbered_name,
                    evidence=line,
                    confidence=0.85,
                    sourceSection=source_section,
                )
            if source_section == "projects":
                personal = re.match(
                    r"^personal project\s*\|\s*(?:fullstack web project:\s*)?(?P<name>[^-]+?)\s*-\s*(?P<description>.+)$",
                    line,
                    re.IGNORECASE,
                )
                labeled = re.match(r"^[●•]?\s*(?P<name>[^:|]{2,80}):\s*(?P<description>.+)$", line)
                match = personal or labeled
                if match is None:
                    return None
                return Project(
                    name=match.group("name").strip(),
                    description=match.group("description").strip(),
                    evidence=line,
                    confidence=0.8,
                    sourceSection=source_section,
                )
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
    def _numbered_project_name(line: str) -> str | None:
        """Recognize compact portfolio titles such as ``1. Product Atlas``."""
        match = re.match(
            r"^\s*\d{1,2}[.)]\s+(?P<name>.+?)(?:\s+\(https?://[^)]+\))?\s*$",
            line,
            re.IGNORECASE,
        )
        if match is None:
            return None
        name = re.sub(r"\s+\(https?://[^)]+\)\s*$", "", match.group("name")).strip()
        lowered = name.casefold()
        if (
            len(name.split()) > 8
            or "://" in name
            or name.endswith(".")
            or lowered.startswith(("responsibilit", "technology", "tech stack", "task", "mô tả"))
            or not name[0].isupper()
        ):
            return None
        return name

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
        degree_pattern = re.compile(
            r"\b(bachelor(?:'?s degree)?|master(?:'?s degree)?|phd|engineer'?s degree|engineer|cử nhân|thạc sĩ|tiến sĩ|kỹ sư)\b",
            re.IGNORECASE,
        )
        institution_pattern = re.compile(r"\b(university|college|school|academy|đại học|cao đẳng|trường)\b", re.IGNORECASE)
        school_pattern = re.compile(
            r"\b((?:[A-Za-zÀ-ỹ0-9&.'-]+\s+){0,5}(?:University|College|School|Academy|Đại học|Cao đẳng|Trường)"
            r"(?:\s+(?!(?:Engineer'?s|Bachelor|Master|Associate)\b)[A-Z][A-Za-zÀ-ỹ.'-]+)?"
            r"(?:,\s*[A-Z][A-Za-zÀ-ỹ .' -]+)?)\b",
            re.IGNORECASE,
        )
        full_degree_pattern = re.compile(
            r"\b(?P<degree>(?:bachelor|master|associate)(?:'?s)?(?:\s+(?:of|in)\s+[A-Za-zÀ-ỹ]+)?|"
            r"engineer'?s degree|cử nhân|thạc sĩ|tiến sĩ|kỹ sư)\b",
            re.IGNORECASE,
        )
        major_pattern = re.compile(
            r"(?:degree|bachelor|master|engineer(?:'?s degree)?)\s+(?:in|of)\s+"
            r"(?P<major>[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ&/ .-]{2,80}?)(?:\s+(?:awarded|gpa|grade|with)\b|[.;]|$)",
            re.IGNORECASE,
        )
        results: list[Education] = []
        normalized_lines: list[str] = []
        for line in lines:
            if (
                normalized_lines
                and re.match(r"^(?:university|college|school|academy|đại học|cao đẳng|trường)\b", line, re.IGNORECASE)
                and degree_pattern.search(normalized_lines[-1])
            ):
                normalized_lines[-1] = f"{normalized_lines[-1]} {line}"
            else:
                normalized_lines.append(line)
        for line in normalized_lines:
            if re.match(r"^(?:english|tiếng anh)\b", line, re.IGNORECASE):
                continue
            major_match = re.match(r"^major\s*:\s*(.+)$", line, re.IGNORECASE)
            if major_match and results:
                results[-1] = results[-1].model_copy(update={"major": major_match.group(1)})
                continue
            if re.match(r"^(?:current\s+)?gpa\s*:", line, re.IGNORECASE):
                continue
            date_match = _DATE_RANGE.search(line)
            degree_match = full_degree_pattern.search(line) or degree_pattern.search(line)
            if not date_match and not degree_match and not institution_pattern.search(line):
                continue
            school_match, major_match = school_pattern.search(line), major_pattern.search(line)
            major = major_match.group("major").strip() if major_match else None
            if degree_match and school_match:
                between = line[degree_match.end():school_match.start()].strip()
                parentheticals = re.findall(r"\(([^)]+)\)", between)
                candidate_major = next(
                    (value.strip() for value in parentheticals if value.strip().casefold() not in {"honors", "honours", "transfer"}),
                    None,
                )
                if candidate_major:
                    major = candidate_major
                elif between.casefold().startswith("in "):
                    major = re.sub(r"\s*\([^)]*\)", "", between[3:]).strip() or None
            school = (
                line.strip()
                if institution_pattern.search(line) and not degree_match
                else (school_match.group(1).strip() if school_match else (line if not degree_match else None))
            )
            if school:
                school = re.sub(
                    r"^(?:(?:bachelor|master|associate)(?:'?s)?(?:\s+(?:of|in)\s+[A-Za-zÀ-ỹ]+)?|"
                    r"engineer'?s degree)\s+",
                    "",
                    school,
                    flags=re.IGNORECASE,
                )
            results.append(Education(
                school=school,
                degree=degree_match.group(0) if degree_match else None,
                major=major,
                startDate=date_match.group("start") if date_match else None,
                endDate=date_match.group("end") if date_match else None,
                evidence=line, confidence=0.7, sourceSection="education",
            ))
        return StructuredCvParser._merge_education_evidence(results, normalized_lines)

    @staticmethod
    def _merge_education_evidence(existing: list[Education], lines: list[str]) -> list[Education]:
        """Assemble adjacent education facts without relying on one CV template."""
        institution = re.compile(r"\b(?:university|college|school|academy|institute|đại học|cao đẳng|trường)\b", re.IGNORECASE)
        degree = re.compile(r"\b(?:bachelor|master|associate|phd|engineer|cử nhân|thạc sĩ|tiến sĩ|kỹ sư)\b", re.IGNORECASE)
        groups: list[list[str]] = []
        current: list[str] = []
        for line in lines:
            if re.match(r"^(?:english|tiếng anh)\b", line, re.IGNORECASE):
                continue
            starts_new = bool(institution.search(line)) and any(institution.search(item) for item in current)
            if starts_new:
                groups.append(current)
                current = []
            current.append(line)
        if current:
            groups.append(current)

        assembled: list[Education] = []
        for group in groups:
            evidence = " | ".join(group)
            school = next((item for item in group if institution.search(item)), None)
            degree_value = next((item for item in group if degree.search(item)), None)
            date_match = _DATE_RANGE.search(evidence)
            major_match = re.search(
                r"(?:major|specialization|field of study|chuyên ngành|ngành)\s*:\s*(.+?)(?:\s*[|;]|$)",
                evidence,
                re.IGNORECASE,
            )
            if not school and not degree_value:
                continue
            assembled.append(Education(
                school=school,
                degree=degree_value,
                major=major_match.group(1).strip() if major_match else None,
                startDate=date_match.group("start") if date_match else None,
                endDate=date_match.group("end") if date_match else None,
                evidence=evidence,
                confidence=0.82 if school and degree_value else 0.7,
                sourceSection="education",
            ))
        if not assembled:
            return existing
        if existing:
            def completeness(item: Education) -> int:
                school_is_date = bool(item.school and _DATE_RANGE.fullmatch(item.school.strip()))
                return (
                    bool(item.school and not school_is_date)
                    + bool(item.degree)
                    + bool(item.major)
                    + bool(item.start_date and item.end_date)
                )

            existing_completeness = sum(
                completeness(item) for item in existing
            )
            assembled_completeness = sum(
                completeness(item) for item in assembled
            )
            if existing_completeness >= assembled_completeness and len(existing) <= len(assembled):
                return existing
            if len(assembled) < len(existing) and all(
                item.school and item.degree and item.start_date and item.end_date
                for item in assembled
            ):
                if len(assembled) == 1 and not assembled[0].major:
                    recovered_major = next((item.major for item in existing if item.major), None)
                    if recovered_major:
                        return [assembled[0].model_copy(update={"major": recovered_major})]
                return assembled
            if assembled_completeness >= existing_completeness and len(assembled) < len(existing):
                return assembled
        unique: dict[str, Education] = {}
        for item in [*existing, *assembled]:
            key = normalize_text(
                "|".join(part or "" for part in (item.school, item.degree, item.start_date, item.end_date)),
                lowercase=True,
            )
            if key and (key not in unique or item.confidence > unique[key].confidence):
                unique[key] = item
        return list(unique.values())

    @staticmethod
    def _parse_certifications(lines: list[str]) -> list[Certification]:
        results: list[Certification] = []
        for line in StructuredCvParser._merge_wrapped_certification_lines(lines):
            value = line.strip(" -•")
            normalized = normalize_text(value, lowercase=True)
            if (
                not value
                or normalized in {"& short courses", "and short courses", "short courses", "courses", "training"}
                or StructuredCvParser._heading_match(value)
            ):
                continue
            issuer = None
            toeic = re.fullmatch(r"(?P<name>TOEIC\s*\(\d{4}\))\s*,\s*(?P<issuer>.+)", value, re.IGNORECASE)
            if toeic:
                issuer = toeic.group("issuer").strip()
            if "coursera" in normalized and results:
                previous = results.pop()
                results.append(Certification(
                    name=previous.name,
                    issuer=value,
                    evidence=f"{previous.evidence} {value}",
                    confidence=0.82,
                    sourceSection="certifications",
                ))
                continue
            results.append(Certification(
                name=value,
                issuer=issuer,
                evidence=value, confidence=0.82, sourceSection="certifications",
            ))
        return results

    @staticmethod
    def _merge_wrapped_certification_lines(lines: list[str]) -> list[str]:
        """Join certificate names which a PDF text layer wrapped after a comma."""
        merged: list[str] = []
        pending: str | None = None
        standard_certificate = re.compile(r"^(?:toeic|ielts|toefl|pmp|aws|azure|google\s+cloud)\b", re.IGNORECASE)
        for line in lines:
            value = line.strip()
            if pending and pending.rstrip().endswith((",", ":", "-")) and not standard_certificate.search(value):
                pending = f"{pending} {value}"
                continue
            if pending:
                merged.append(pending)
            pending = value
        if pending:
            merged.append(pending)
        return merged

    @staticmethod
    def _parse_awards(lines: list[str]) -> list[str]:
        """Keep award name and a visually detached year together when evidenced."""
        results: list[str] = []
        pending_year: str | None = None
        for line in lines:
            value = line.strip(" -•")
            normalized = normalize_text(value, lowercase=True)
            if not value or normalized in {"and awards", "& awards", "awards"}:
                continue
            if re.fullmatch(r"(?:19|20)\d{2}", value):
                if results and not re.search(r"\b(?:19|20)\d{2}\b", results[-1]):
                    results[-1] = f"{value} — {results[-1]}"
                else:
                    pending_year = value
                continue
            if pending_year:
                value = f"{pending_year} — {value}"
                pending_year = None
            results.append(value)
        return list(dict.fromkeys(results))

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
        skipping_group_details = False
        pending_dates: tuple[str, str] | None = None
        for line in project_section:
            date_match = _DATE_RANGE.fullmatch(line.strip("[] "))
            if date_match:
                pending_dates = (date_match.group("start"), date_match.group("end"))
                continue
            if cls._is_project_metadata_line(line):
                if results and not skipping_group_details:
                    previous = results[-1]
                    description = " ".join(part for part in (previous.description, line.strip()) if part)
                    results[-1] = previous.model_copy(
                        update={
                            "description": description,
                            "evidence": f"{previous.evidence} | {line}",
                        }
                    )
                continue
            project = cls._project_from_line(line, source_section="projects")
            if project is None:
                if cls._is_project_group_line(line):
                    skipping_group_details = True
                    continue
                pieces = re.split(r"\s+[–—-]\s+", line, maxsplit=1)
                if len(pieces) == 2:
                    name, description = pieces
                    if name.strip() and not _DATE_RANGE.search(line):
                        project = Project(
                            name=name.strip(),
                            description=description.strip() if description else None,
                            evidence=line,
                            confidence=0.75,
                            sourceSection="projects",
                        )
                if project is None:
                    if (
                        2 <= len(line) <= 72
                        and len(line.split()) <= 10
                        and not _DATE_RANGE.search(line)
                        and not re.search(r"^(?:description|responsibilities|tech(?:nologies| stack)?)\b", line, re.IGNORECASE)
                        and any(character.isupper() for character in line)
                        and cls._looks_like_project_title(line)
                    ):
                        project = Project(
                            name=line.strip(" -•"),
                            evidence=line,
                            confidence=0.7,
                            sourceSection="projects",
                        )
                    if project is not None:
                        skipping_group_details = False
                        results.append(project)
                        continue
                    if results and not skipping_group_details:
                        previous = results[-1]
                        description = " ".join(part for part in (previous.description, line) if part)
                        results[-1] = previous.model_copy(
                            update={
                                "description": description,
                                "evidence": f"{previous.evidence} | {line}",
                            }
                        )
                    continue
            skipping_group_details = False
            if project.start_date is None and pending_dates is not None:
                project = project.model_copy(
                    update={
                        "start_date": pending_dates[0],
                        "end_date": pending_dates[1],
                        "evidence": f"{pending_dates[0]} - {pending_dates[1]} | {project.evidence}",
                    }
                )
            pending_dates = None
            results.append(project)
        return [
            project.model_copy(
                update={
                    "technologies": cls._known_technologies(
                        " ".join(
                            part for part in (project.name, project.description, project.evidence) if part
                        )
                    )
                }
            )
            for project in results
        ]

    @staticmethod
    def _is_project_group_line(line: str) -> bool:
        lowered = normalize_text(line, lowercase=True)
        if lowered in {"portfolio", "gameplay videos:"} or re.match(
            r"^(?:other|previous|selected|personal)\s+projects?\b", lowered
        ):
            return True
        return "|" in line and not re.search(r"\b(?:plays?|q[1-4]|https?)\b", lowered)

    @staticmethod
    def _is_project_metadata_line(line: str) -> bool:
        return bool(re.match(r"^(?:link\s*(?:product|project)?|demo|repository|repo|github)\s*:", line, re.IGNORECASE))

    @staticmethod
    def _looks_like_project_title(line: str) -> bool:
        if line.rstrip().endswith((".", ":", "!", "?")) or "://" in line:
            return False
        words = re.findall(r"[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ0-9.+#/-]*", line)
        if not 2 <= len(words) <= 8:
            return False
        connectors = {"and", "of", "the", "for", "to", "in", "on", "with", "&"}
        non_connectors = [word for word in words if word.casefold() not in connectors]
        if (
            len(non_connectors) >= 2
            and any(word.casefold() in {"and", "&"} for word in words)
            and len(StructuredCvParser._known_technologies(line)) >= 2
        ):
            return False
        return all(word.casefold() in connectors or word.isupper() or word[:1].isupper() for word in words)

    @staticmethod
    def _known_technologies(text: str) -> list[str]:
        lowered = normalize_text(text, lowercase=True)
        return [
            canonical
            for canonical, variants in _SKILL_ALIASES.items()
            if canonical != "communication" or re.search(r"\bcommunication\s+skills?\b", lowered)
            if any(re.search(rf"(?<!\w){re.escape(variant)}(?!\w)", lowered) for variant in variants)
        ]

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
