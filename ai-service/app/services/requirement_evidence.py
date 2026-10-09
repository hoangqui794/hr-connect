"""Conservative clause evaluation with source spans, independent of CV templates.

Vocabulary identifies capabilities, not people, companies, or fixture filenames.
Unrecognized clauses remain visible for review. Retrieval never proves a claim.
"""
import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

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
    Capability("Measured improvement", r"measurable|đo lường|cải thiện thực tế", r".+"),
    Capability("OOP", r"\boop\b|object.oriented", r"\boop\b|object.oriented"),
    Capability("SOLID", r"\bsolid\b", r"\bsolid\b"),
    Capability("Design patterns", r"design patterns?", r"design patterns?"),
    Capability("Testable code", r"testable|kiểm thử", r"unit test\w*|integration test\w*|test.driven|testable|kiểm thử"),
    Capability("Maintainable code", r"maintainable|bảo trì", r"maintainab\w*|refactor\w* (?:of )?(?:legacy|the code ?base|for (?:readability|maintainability))|bảo trì"),
    Capability("Readable code", r"readable", r"readable|coding standards|code quality standards"),
    Capability(
        "Mentoring",
        r"\bmentor(?:ing|ed|s)?\b|cố vấn|hướng dẫn (?:thành viên|nhân viên|đội ngũ|team)",
        r"\bmentor(?:ing|ed|s)?\b|cố vấn|hướng dẫn (?:thành viên|nhân viên|đội ngũ|team)",
    ),
    Capability("Sales prospecting", r"prospecting|tìm kiếm khách hàng", r"prospect\w*|generated leads|tìm kiếm khách hàng"),
    Capability("Negotiation", r"negotiat\w*|đàm phán", r"negotiat\w*|đàm phán"),
    Capability("Content creation", r"content creation|sáng tạo nội dung", r"(?:created|produced|wrote).{0,30}(?:content|articles|posts)|sáng tạo nội dung|viết bài"),
    Capability("Campaign analysis", r"campaign analysis|phân tích chiến dịch", r"analy[sz](?:ed|ing).{0,30}campaign|phân tích.{0,20}chiến dịch"),
)
_DEFAULT_LEXICON = Path(__file__).resolve().parents[1] / "data" / "capability_lexicon.json"


@lru_cache(maxsize=1)
def load_capabilities() -> tuple[Capability, ...]:
    """Built-in capabilities merged with the configurable lexicon file.

    The lexicon lets HR widen accepted phrasings without code changes; every
    match it produces is still flagged for human review.
    """
    configured = get_settings().capability_lexicon_path
    path = Path(configured) if configured else _DEFAULT_LEXICON
    if not path.is_file():
        return CAPABILITIES
    lexicon = json.loads(path.read_text(encoding="utf-8"))
    extend = lexicon.get("extend", {})
    merged = [
        Capability(c.name, c.trigger, "|".join([c.evidence, *extend[c.name]]) if extend.get(c.name) else c.evidence)
        for c in CAPABILITIES
    ]
    by_name = {capability.name: index for index, capability in enumerate(merged)}
    for item in lexicon.get("add", []):
        # A duplicate name would count the same criterion twice in ALL_OF
        # requirements, so an existing capability is widened instead.
        if item["name"] in by_name:
            existing = merged[by_name[item["name"]]]
            merged[by_name[item["name"]]] = Capability(
                existing.name, f"{existing.trigger}|{item['trigger']}", f"{existing.evidence}|{item['evidence']}"
            )
        else:
            by_name[item["name"]] = len(merged)
            merged.append(Capability(item["name"], item["trigger"], item["evidence"]))
    for capability in merged:
        re.compile(capability.trigger)
        re.compile(capability.evidence)
    return tuple(merged)


_UNSUPPORTED = re.compile(r"\b(?:no|not|without|lack\w*|want to|wish to|seeking to|plan to|aim to|aspir\w*)\b|chưa có|không có|mong muốn", re.I)
_THIRD_PARTY = re.compile(r"\bby (?:the )?(?:ba|another|other|external|design)\b|do nhóm khác", re.I)
_LEADING_CONNECTOR = re.compile(r"^(?:(?:and|or|và|hoặc)\b[\s,:;-]*)+", re.I)
_PERFORMANCE_CONTEXT = re.compile(
    r"\b(?:optimi[sz]\w*|improv\w*|reduc\w*|increas\w*|accelerat\w*|"
    r"throughput|latency|response time|load time|page load|capacity|scal(?:e|ed|ing)|"
    r"process(?:ed|ing)?|handl(?:ed|ing)|concurren\w*|quer(?:y|ies)|index(?:ed|ing)?)\b",
    re.I,
)
_PERFORMANCE_SCALE_METRIC = re.compile(
    r"\b\d[\d.,]*\s*(?:[kmb]\s*)?\+?\s*(?:ms\b|milliseconds?\b|seconds?\b|"
    r"req(?:uests?)?\s*/\s*s\b|rps\b|qps\b|(?:daily\s+)?records?\b|users?\b|"
    r"transactions?\b|requests?\b)",
    re.I,
)
_PERFORMANCE_PERCENT = re.compile(
    r"\b(?:improv\w*|reduc\w*|increas\w*|accelerat\w*|optimi[sz]\w*)"
    r"[^.!?\n]{0,60}\b\d[\d.,]*\s*%",
    re.I,
)


_SOFT_WRAP = re.compile(r"(?<![.!?:;])\n(?=[ \t]*[a-zà-ỹ0-9(])")


def _logical_lines(text: str) -> list[tuple[int, str]]:
    """Lines with PDF soft wraps rejoined ("from 3+\\nseconds to sub 100ms").

    A wrap is a newline after a line that does not end a sentence, followed by
    a lowercase word or number. It becomes a space, so lengths and offsets in
    the original text are unchanged.
    """
    unwrapped = _SOFT_WRAP.sub(" ", text)
    return [(match.start(), match.group()) for match in re.finditer(r"[^\n]+", unwrapped)]


def evidence_spans(text: str) -> list[dict]:
    """Offsets refer to the exact CV text supplied to this evaluator.

    A span that crosses a soft-wrapped line shows the wrap as a space; it covers
    the same characters as text[start:end].
    """
    spans = []
    for line_start, line in _logical_lines(text):
        # Keep bullet/newline boundaries; split sentences only at sentence ends.
        for part in re.finditer(r".+?(?:[.!?](?=\s+[A-ZÀ-Ỹ])|$)", line):
            value = part.group().strip()
            if value:
                start = line_start + part.start() + len(part.group()) - len(part.group().lstrip())
                spans.append({"text": value, "start": start, "end": start + len(value), "source": "cvText"})
    return spans


def is_supported_span(text: str) -> bool:
    """False for aspirations, negations, or work credited to someone else."""
    return not _UNSUPPORTED.search(text) and not _THIRD_PARTY.search(text)


def _normalize_fragment(fragment: str) -> str:
    """Remove list syntax without weakening the clause itself."""
    value = fragment.strip(" ,.;:-")
    return _LEADING_CONNECTOR.sub("", value).strip(" ,.;:-")


def _is_measured_performance_span(value: str) -> bool:
    """A metric is evidence only when its sentence also describes performance."""
    return bool(
        _PERFORMANCE_PERCENT.search(value)
        or (_PERFORMANCE_CONTEXT.search(value) and _PERFORMANCE_SCALE_METRIC.search(value))
    )


def _evidence_rank(capability: Capability, span: dict) -> tuple[int, int]:
    """Prefer the most specific evidence while keeping source order stable."""
    if capability.name != "Measured improvement":
        return (0, -span["start"])
    value = span["text"]
    score = (
        len(_PERFORMANCE_CONTEXT.findall(value))
        + len(_PERFORMANCE_SCALE_METRIC.findall(value)) * 2
        + len(_PERFORMANCE_PERCENT.findall(value)) * 2
    )
    return (score, -span["start"])


# Performance work needs an action by the candidate; "powered by Vite for
# high-performance bundling" describes a tool, not optimization they did.
_PERFORMANCE_WORK = {"Backend performance", "Client performance"}
_PERFORMANCE_ACTION = re.compile(
    r"\b(?:optimi[sz](?:ed|es|ing|ation)|improv\w*|reduc\w*|cut(?:s|ting)?|speed\w*|accelerat\w*|"
    r"eliminat\w*|tun(?:ed|ing)|cach(?:ed|ing)|index(?:ed|ing)|prevent\w*|tối ưu|cải thiện|giảm)\b",
    re.I,
)


def _find_evidence(capability: Capability, spans: list[dict]) -> dict | None:
    matches = [
        span for span in spans
        if re.search(capability.evidence, span["text"], re.I)
        and not _UNSUPPORTED.search(span["text"])
        and not _THIRD_PARTY.search(span["text"])
        and (capability.name != "Measured improvement" or _is_measured_performance_span(span["text"]))
        and (capability.name not in _PERFORMANCE_WORK or _PERFORMANCE_ACTION.search(span["text"]))
    ]
    return max(matches, key=lambda span: _evidence_rank(capability, span), default=None)


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
    capabilities = [c for c in load_capabilities() if re.search(c.trigger, content, re.I)]
    # Keep unsupported conjuncts instead of reporting a full match for only
    # the recognized part (e.g. negotiation AND underwater welding).
    fragments = re.split(r"\s+\b(?:and|or|và|hoặc)\b\s+|,\s*", content, flags=re.I)
    for fragment in fragments:
        fragment = _normalize_fragment(fragment)
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
        found = _find_evidence(capability, spans)
        criteria.append({"criterion": capability.name, "status": "MATCHED" if found else "NOT_FOUND", "evidence": found})
    count = sum(c["status"] == "MATCHED" for c in criteria)
    coverage = float(bool(count)) if operator == "ANY_OF" else count / len(criteria)
    # Capability vocabulary is bounded, so inferred decomposition always stays
    # reviewable instead of pretending to understand every residual clause.
    warnings = ["INFERRED_CRITERIA_REVIEW"]
    performance_group_resolved = {
        "Backend performance", "Client performance", "Measured improvement"
    }.issubset({capability.name for capability in capabilities})
    if has_and and has_or and not performance_group_resolved:
        warnings.append("MIXED_REQUIREMENT_LOGIC_REVIEW")
    return {"criteria": criteria, "operator": operator, "coverage": coverage,
            "status": "MATCHED" if coverage == 1 else "PARTIAL" if count else "NOT_FOUND",
            "warnings": warnings}
