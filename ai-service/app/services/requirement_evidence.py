"""Conservative clause evaluation with source spans, independent of CV templates.

Vocabulary identifies capabilities, not people, companies, or fixture filenames.
Unrecognized clauses remain visible for review. Retrieval never proves a claim.
"""
import re
from dataclasses import dataclass

from app.schemas.matching_request import JobRequirement


@dataclass(frozen=True)
class Capability:
    name: str
    trigger: str
    evidence: str


CAPABILITIES = (
    Capability("Frontend codebase architecture", r"(?:frontend.*codebase|codebase.*frontend|kiến trúc.*frontend)", r"(?:source\s*base|codebase)\s+architecture|(?:built|established|standardized).{0,45}(?:source\s*base|codebase)|chuẩn hóa.{0,30}frontend"),
    Capability("Reusable UI components", r"reusable|tái sử dụng", r"reusable\s+(?:ui\s+)?components|component.{0,25}tái sử dụng"),
    Capability("Database design", r"database design|data model|thiết kế (?:cơ sở dữ liệu|dữ liệu)", r"(?:designed|modeled|modelled|created).{0,30}(?:database|schema|data model)|(?:database|schema)\s+design|thiết kế.{0,20}cơ sở dữ liệu"),
    Capability("Query optimization", r"query optim|tối ưu (?:truy vấn|query)", r"optimi[sz](?:ed|ing|ation).{0,25}(?:quer|index)|(?:quer|index).{0,25}optimi[sz]|indexing|stored procedures.{0,35}performance|tối ưu.{0,20}truy vấn"),
    Capability("Problem analysis", r"problem analysis|problem.solving|phân tích vấn đề|giải quyết vấn đề", r"root.cause|troubleshoot\w*|analy[sz](?:ed|ing).{0,30}(?:problem|issue|incident)|phân tích nguyên nhân|giải quyết vấn đề"),
    Capability("Teamwork", r"teamwork|team collaboration|phối hợp|đội nhóm|làm việc nhóm", r"collaborat\w*|worked closely with|teamwork|phối hợp|làm việc nhóm"),
    Capability("Technical proposals", r"propos\w*|đề xuất", r"propos(?:ed|ing).{0,50}(?:solution|architecture|technical)|đề xuất.{0,35}(?:giải pháp|kỹ thuật)"),
    Capability("Backend performance", r"backend.*(?:performance|tối ưu)|(?:performance|tối ưu).*backend", r"(?:quer|index|database|backend|server).{0,65}(?:optimi|performance|throughput)|(?:optimi|performance|throughput).{0,65}(?:quer|index|database|backend|server)"),
    Capability("Client performance", r"(?:client|frontend).*(?:performance|tối ưu)|(?:performance|tối ưu).*(?:client|frontend)", r"(?:client|frontend|render|page|web vital|lighthouse).{0,65}(?:optimi|performance|latency|load time)|(?:optimi|reduced|improved).{0,65}(?:render|page load|client performance|frontend performance)"),
    Capability("Measured improvement", r"measurable|đo lường|cải thiện thực tế", r"\d[\d.,]*\s*(?:%|ms\b|req/s|records|daily)|throughput|response time.{0,20}\d"),
    Capability("OOP", r"\boop\b|object.oriented", r"\boop\b|object.oriented"),
    Capability("SOLID", r"\bsolid\b", r"\bsolid\b"),
    Capability("Design patterns", r"design patterns?", r"design patterns?"),
    Capability("Testable code", r"testable|kiểm thử", r"unit test\w*|integration test\w*|test.driven|testable|kiểm thử"),
    Capability("Maintainable code", r"maintainable|bảo trì", r"maintainab\w*|refactor\w*|bảo trì"),
    Capability("Readable code", r"readable", r"readable|coding standards|code quality standards"),
    Capability("Sales prospecting", r"prospecting|tìm kiếm khách hàng", r"prospect\w*|generated leads|tìm kiếm khách hàng"),
    Capability("Negotiation", r"negotiat\w*|đàm phán", r"negotiat\w*|đàm phán"),
    Capability("Content creation", r"content creation|sáng tạo nội dung", r"(?:created|produced|wrote).{0,30}(?:content|articles|posts)|sáng tạo nội dung|viết bài"),
    Capability("Campaign analysis", r"campaign analysis|phân tích chiến dịch", r"analy[sz](?:ed|ing).{0,30}campaign|phân tích.{0,20}chiến dịch"),
)
_UNSUPPORTED = re.compile(r"\b(?:no|not|without|lack\w*|want to|wish to|seeking to|plan to|aim to|aspir\w*)\b|chưa có|không có|mong muốn", re.I)
_THIRD_PARTY = re.compile(r"\bby (?:the )?(?:ba|another|other|external|design)\b|do nhóm khác", re.I)


def evidence_spans(text: str) -> list[dict]:
    """Offsets refer to the exact CV text supplied to this evaluator."""
    spans = []
    for match in re.finditer(r"[^\n]+", text):
        # Keep bullet/newline boundaries; split sentences only at sentence ends.
        for part in re.finditer(r".+?(?:[.!?](?=\s+[A-ZÀ-Ỹ])|$)", match.group()):
            value = part.group().strip()
            if value:
                start = match.start() + part.start() + len(part.group()) - len(part.group().lstrip())
                spans.append({"text": value, "start": start, "end": start + len(value), "source": "cvText"})
    return spans


def evaluate_clauses(requirement: JobRequirement, text: str) -> dict | None:
    """Return capability results for plain-language OTHER requirements.

    Explicit evidenceGroups retain their established path, except compound
    performance requirements where global indexing cannot prove client work.
    """
    content = requirement.content
    if requirement.category.value != "OTHER":
        return None
    if requirement.evidence_groups and not re.search(r"backend.*(?:and|và).*client.*performance", content, re.I):
        return None
    capabilities = [c for c in CAPABILITIES if re.search(c.trigger, content, re.I)]
    # Keep unsupported conjuncts instead of reporting a full match for only
    # the recognized part (e.g. negotiation AND underwater welding).
    fragments = re.split(r"\s+\b(?:and|or|và|hoặc)\b\s+|,\s*", content, flags=re.I)
    for fragment in fragments:
        fragment = fragment.strip(" ,.")
        if not fragment or re.fullmatch(r"(?:build|design|develop|standardize)", fragment, re.I):
            continue
        if any(re.search(c.trigger, fragment, re.I) for c in capabilities):
            continue
        # Shared modifiers: 'backend and client performance optimization'.
        if re.search(r"performance", content, re.I) and re.search(r"backend|client|response time|user experience|system capacity", fragment, re.I):
            continue
        capabilities.append(Capability(fragment, re.escape(fragment), rf"(?<!\w){re.escape(fragment)}(?!\w)"))
    if not capabilities:
        return None
    # Mixed conjunctions cannot be flattened safely. Expose for review.
    has_and = bool(re.search(r"\b(?:and|và)\b", content, re.I))
    has_or = bool(re.search(r"\b(?:or|hoặc)\b", content, re.I))
    operator = "ANY_OF" if has_or and not has_and else "ALL_OF"
    spans = evidence_spans(text)
    criteria = []
    for capability in capabilities:
        found = next((s for s in spans if re.search(capability.evidence, s["text"], re.I)
                      and not _UNSUPPORTED.search(s["text"])
                      and not _THIRD_PARTY.search(s["text"])), None)
        criteria.append({"criterion": capability.name, "status": "MATCHED" if found else "NOT_FOUND", "evidence": found})
    count = sum(c["status"] == "MATCHED" for c in criteria)
    coverage = float(bool(count)) if operator == "ANY_OF" else count / len(criteria)
    # Capability vocabulary is bounded, so inferred decomposition always stays
    # reviewable instead of pretending to understand every residual clause.
    warnings = ["INFERRED_CRITERIA_REVIEW"]
    if has_and and has_or:
        warnings.append("MIXED_REQUIREMENT_LOGIC_REVIEW")
        criteria.append({"criterion": "Unresolved AND/OR grouping", "status": "NOT_FOUND", "evidence": None})
        coverage = count / len(criteria)
    return {"criteria": criteria, "operator": operator, "coverage": coverage,
            "status": "MATCHED" if coverage == 1 else "PARTIAL" if count else "NOT_FOUND",
            "warnings": warnings}
