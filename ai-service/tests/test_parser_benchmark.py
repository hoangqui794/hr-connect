import json
from pathlib import Path

from app.services.parser_evaluation import evaluate_anonymized_cases, summarize_local_observations


def test_anonymized_parser_benchmark_fixture_meets_regression_gate() -> None:
    fixture = Path(__file__).parent / "fixtures" / "parser_benchmark.json"
    cases = json.loads(fixture.read_text(encoding="utf-8"))
    metrics = evaluate_anonymized_cases(cases)

    assert {field: metric.accuracy for field, metric in metrics.items()} == {
        field: 1.0 for field in metrics
    }


def test_local_benchmark_summary_contains_no_cv_content_or_filenames() -> None:
    summary = summarize_local_observations([
        {"layout": "MULTI_COLUMN", "extractionMethod": "PDF_TEXT", "requiresManualReview": False},
        {"layout": "UNSTRUCTURED", "extractionMethod": "PDF_OCR", "requiresManualReview": True},
        {"failureCode": "CvProcessingError"},
        {"skippedOcr": True},
    ])

    assert summary == {
        "documentsProcessed": 4,
        "manualReviewCount": 1,
        "manualReviewRate": 0.5,
        "layoutCounts": {"MULTI_COLUMN": 1, "UNSTRUCTURED": 1},
        "extractionMethodCounts": {"PDF_OCR": 1, "PDF_TEXT": 1},
        "failureCounts": {"CvProcessingError": 1},
        "skippedOcrCount": 1,
        "warningCounts": {},
        "fieldDetectedCounts": {"contact": 0, "skills": 0, "education": 0, "experience": 0},
    }
