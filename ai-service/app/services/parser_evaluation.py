"""Privacy-safe field-level scoring for anonymized parser fixtures."""

from __future__ import annotations

from collections import defaultdict
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass

from app.services.structured_cv_parser import StructuredCvParser


_FIELDS = ("contact", "skills", "education", "experience")


@dataclass(frozen=True)
class FieldMetric:
    correct: int
    total: int

    @property
    def accuracy(self) -> float:
        return round(self.correct / self.total, 4) if self.total else 1.0


def evaluate_anonymized_cases(cases: Iterable[dict[str, object]]) -> dict[str, FieldMetric]:
    """Evaluate only booleans/counts declared in fixtures, never raw CV files."""
    parser = StructuredCvParser()
    totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for case in cases:
        expected = case["expected"]
        assert isinstance(expected, dict)
        result = parser.parse_with_diagnostics(str(case["text"]))
        actual = {
            "contact": bool(result.candidate.email or result.candidate.phone),
            "skills": bool(result.candidate.skills),
            "education": bool(result.candidate.education),
            "experience": bool(result.candidate.work_experience),
        }
        for field in _FIELDS:
            if field not in expected:
                continue
            totals[field][1] += 1
            totals[field][0] += actual[field] == expected[field]
        if "experienceCount" in expected:
            totals["experienceRecordCount"][1] += 1
            totals["experienceRecordCount"][0] += (
                len(result.candidate.work_experience) == expected["experienceCount"]
            )
        if "manualReview" in expected:
            totals["manualReview"][1] += 1
            totals["manualReview"][0] += (
                result.requires_manual_review is expected["manualReview"]
            )
    return {field: FieldMetric(correct=value[0], total=value[1]) for field, value in totals.items()}


def summarize_local_observations(observations: Iterable[dict[str, object]]) -> dict[str, object]:
    """Return aggregate quality signals without filenames, CV text, or PII."""
    rows = list(observations)
    successful = [row for row in rows if not row.get("failureCode") and not row.get("skippedOcr")]
    layouts = Counter(str(row.get("layout", "UNSTRUCTURED")) for row in successful)
    methods = Counter(str(row.get("extractionMethod", "UNKNOWN")) for row in successful)
    failures = Counter(str(row["failureCode"]) for row in rows if row.get("failureCode"))
    warnings = Counter(
        str(warning)
        for row in successful
        for warning in row.get("warnings", [])
    )
    skipped_ocr = sum(bool(row.get("skippedOcr")) for row in rows)
    reviewed = sum(bool(row.get("requiresManualReview")) for row in successful)
    field_coverage = {
        field: sum(bool(row.get(field)) for row in successful)
        for field in _FIELDS
    }
    return {
        "documentsProcessed": len(rows),
        "manualReviewCount": reviewed,
        "manualReviewRate": round(reviewed / len(successful), 4) if successful else 0.0,
        "layoutCounts": dict(sorted(layouts.items())),
        "extractionMethodCounts": dict(sorted(methods.items())),
        "failureCounts": dict(sorted(failures.items())),
        "skippedOcrCount": skipped_ocr,
        "warningCounts": dict(sorted(warnings.items())),
        "fieldDetectedCounts": field_coverage,
    }
