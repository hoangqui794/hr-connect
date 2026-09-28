import json
from pathlib import Path

from app.services.structured_cv_parser import StructuredCvParser


def test_anonymized_parser_benchmark_fixture_meets_regression_gate() -> None:
    fixture = Path(__file__).parent / "fixtures" / "parser_benchmark.json"
    cases = json.loads(fixture.read_text(encoding="utf-8"))
    parser = StructuredCvParser()

    for case in cases:
        result = parser.parse_with_diagnostics(case["text"])
        expected = case["expected"]
        actual = {
            "contact": bool(result.candidate.email or result.candidate.phone),
            "skills": bool(result.candidate.skills),
            "education": bool(result.candidate.education),
            "experience": bool(result.candidate.work_experience),
        }
        assert actual == {field: expected[field] for field in actual}, case["id"]
        if "manualReview" in expected:
            assert result.requires_manual_review is expected["manualReview"], case["id"]
