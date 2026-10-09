import json
import sys
from pathlib import Path

import numpy as np
import pytest

from app.core.config import get_settings
from app.schemas.matching_request import RequirementType
from app.schemas.matching_response import RequirementMatch
from app.services.matching_service import _apply_semantic_partial_credit
from app.services.requirement_evidence import load_capabilities, load_lexicon
from app.services.semantic_matcher import SemanticMatcher

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from evaluate_scoring import _calibrate, _requirement_statuses, tier  # noqa: E402


def _unresolved(status: str = "NOT_FOUND", coverage: float = 0.0) -> RequirementMatch:
    return RequirementMatch(
        requirement="Problem analysis", type=RequirementType.MUST_HAVE, matched=False,
        matchStatus=status, evidenceCoverage=coverage, similarity=coverage,
        matchMethod="NOT_FOUND" if status == "NOT_FOUND" else "DETERMINISTIC_PARTIAL",
        requiresManualReview=True,
    )


def test_semantic_credit_is_partial_and_keeps_review() -> None:
    item = _unresolved()
    _apply_semantic_partial_credit(item, ({"text": "Investigated production incidents.", "similarity": 0.8}, 0.8))

    assert item.match_status == "PARTIAL"
    assert item.matched is False
    assert item.evidence_coverage == get_settings().evidence_partial_credit
    assert item.match_method == "SEMANTIC_PARTIAL"
    assert item.requires_manual_review is True
    assert "SEMANTIC_PARTIAL_CREDIT" in item.warnings


def test_semantic_credit_ignores_weak_or_missing_evidence() -> None:
    weak = _unresolved()
    _apply_semantic_partial_credit(weak, ({"text": "Built modules.", "similarity": 0.5}, 0.5))
    missing = _unresolved()
    _apply_semantic_partial_credit(missing, (None, 0.0))

    assert weak.match_status == missing.match_status == "NOT_FOUND"
    assert weak.evidence_coverage == missing.evidence_coverage == 0.0


def test_semantic_credit_never_lowers_existing_coverage() -> None:
    item = _unresolved("PARTIAL", 0.67)
    _apply_semantic_partial_credit(item, ({"text": "Investigated incidents.", "similarity": 0.9}, 0.9))

    assert item.evidence_coverage == 0.67
    assert item.match_method == "DETERMINISTIC_PARTIAL"


def test_semantic_credit_can_be_disabled(monkeypatch) -> None:
    monkeypatch.setenv("EVIDENCE_PARTIAL_CREDIT", "0")
    get_settings.cache_clear()
    try:
        item = _unresolved()
        _apply_semantic_partial_credit(item, ({"text": "Investigated incidents.", "similarity": 0.9}, 0.9))
        assert item.match_status == "NOT_FOUND"
    finally:
        get_settings.cache_clear()


class _Embeddings:
    def encode(self, sentences, **kwargs):
        return np.ones((len(sentences), 3))


class _Reranker:
    def predict(self, pairs, **kwargs):
        return np.array([0.95 if "incident" in passage else 0.02 for _, passage in pairs])


def test_best_evidence_skips_aspirations_and_prefers_reranker() -> None:
    text = "Want to learn incident analysis.\nInvestigated production incident root causes.\nWrote docs."
    matcher = SemanticMatcher(_Embeddings(), _Reranker())

    suggestions = matcher.retrieve_evidence(["Problem analysis"], text)[0]
    span, score = matcher.best_supported_evidence(suggestions)

    assert suggestions[0]["rerankScore"] == 0.95
    assert span["text"] == "Investigated production incident root causes."
    assert score == 0.95


def test_lexicon_extends_and_adds_capabilities(tmp_path, monkeypatch) -> None:
    lexicon = tmp_path / "lexicon.json"
    lexicon.write_text(json.dumps({
        "extend": {"Teamwork": ["pair programm\\w*"]},
        "add": [{"name": "Kanban", "trigger": "kanban", "evidence": "kanban board"}],
    }), encoding="utf-8")
    monkeypatch.setenv("CAPABILITY_LEXICON_PATH", str(lexicon))
    get_settings.cache_clear()
    load_lexicon.cache_clear()
    load_capabilities.cache_clear()
    try:
        capabilities = {item.name: item for item in load_capabilities()}
        assert "pair programm" in capabilities["Teamwork"].evidence
        assert capabilities["Kanban"].trigger == "kanban"
    finally:
        get_settings.cache_clear()
        load_lexicon.cache_clear()
        load_capabilities.cache_clear()


def test_default_lexicon_credits_led_team_as_teamwork() -> None:
    from tests.test_requirement_evidence import evaluate

    result = evaluate("Teamwork", "Led development team for a banking POC.")

    assert result.match_status == "MATCHED"


def test_evaluation_helpers() -> None:
    assert [tier(value) for value in (85, 75, 65, 10)] == [">=80", "70-79", "60-69", "<60"]
    job = {"requirements": [
        {"id": "a", "type": "MUST_HAVE"}, {"id": "b", "type": "SHOULD_HAVE"}, {"id": "c", "type": "MUST_HAVE"},
    ]}
    result = {"mustHaveResult": [{"matchStatus": "MATCHED"}, {"matchStatus": "PARTIAL"}],
              "shouldHaveResult": [{"matchStatus": "NOT_FOUND"}]}
    assert _requirement_statuses(job, result) == {"a": "MATCHED", "c": "PARTIAL", "b": "NOT_FOUND"}

    rows = [((1.0, 1.0, 0.9), 95.0), ((0.2, 0.0, 0.1), 15.0)]
    best = _calibrate(rows)[0]
    assert pytest.approx(best["mustHaveWeight"] + best["shouldHaveWeight"] + best["semanticWeight"]) == 1.0
    assert best["mae"] <= 6


def test_hr_feedback_report_flags_disagreements() -> None:
    from hr_feedback_report import build_report

    rows = [
        {"application_id": "1", "match_score": "88", "hr_decision": "SHORTLISTED", "reject_reason_code": ""},
        {"application_id": "2", "match_score": "91", "hr_decision": "REJECTED", "reject_reason_code": "SALARY_MISMATCH"},
        {"application_id": "3", "match_score": "40", "hr_decision": "REJECTED", "reject_reason_code": "SKILL_MISMATCH"},
        {"application_id": "4", "match_score": "45", "hr_decision": "SHORTLISTED", "reject_reason_code": ""},
        {"application_id": "5", "match_score": "72", "hr_decision": "UNDECIDED", "reject_reason_code": ""},
    ]

    report = build_report(rows)

    assert report["byTier"][">=80"]["shortlistRate"] == 0.5
    assert report["byTier"][">=80"]["topRejectReasons"] == {"SALARY_MISMATCH": 1}
    assert {row["application_id"] for row in report["disagreements"]} == {"2", "4"}
    assert report["monotonic"] is True
