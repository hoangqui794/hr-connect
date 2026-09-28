"""Run a privacy-preserving local quality benchmark for the MF-03 CV parser.

The command reads user-owned CV files locally and emits aggregate metrics only.
It never copies source PDFs, extracted text, names, contact details, or per-file
results into the repository or the report.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import Settings
from app.services.document_parser import DocumentParser
from app.services.ocr_service import get_ocr_engine
from app.services.structured_cv_parser import StructuredCvParser


class _OcrDisabled:
    def read_text(self, _image):
        raise RuntimeError("OCR_DISABLED_FOR_BENCHMARK")

    def read_lines(self, _image):
        raise RuntimeError("OCR_DISABLED_FOR_BENCHMARK")


def run(directory: Path, *, include_ocr: bool) -> dict[str, object]:
    files = sorted(directory.glob("*.pdf"))
    if not files:
        raise ValueError("No PDF files found in the supplied directory")

    parser = DocumentParser(Settings(_env_file=None), get_ocr_engine() if include_ocr else _OcrDisabled())
    structured = StructuredCvParser()
    methods: Counter[str] = Counter()
    warnings: Counter[str] = Counter()
    categories: Counter[str] = Counter()
    total = Counter()

    for path in files:
        total["files"] += 1
        try:
            document = parser.parse(path.name, "application/pdf", path.read_bytes())
        except RuntimeError as exc:
            if str(exc) == "OCR_DISABLED_FOR_BENCHMARK":
                total["needs_ocr"] += 1
                categories["OCR_REQUIRED"] += 1
            else:
                total["parse_errors"] += 1
            continue
        except Exception:
            total["parse_errors"] += 1
            continue

        result = structured.parse_with_diagnostics(
            document.text,
            blocks=document.blocks,
            layout=document.layout,
            ocr_applied=document.ocr_applied,
        )
        candidate = result.candidate
        total["parsed"] += 1
        total["has_contact"] += bool(candidate.email or candidate.phone)
        total["has_skills"] += bool(candidate.skills)
        total["has_education"] += bool(candidate.education)
        total["has_experience"] += bool(candidate.work_experience)
        total["manual_review"] += result.requires_manual_review
        methods[document.extraction_method] += 1
        categories["TEXT_LAYER"] += document.extraction_method == "PDF_TEXT"
        categories["OCR"] += document.ocr_applied
        categories["LAYOUT"] += "MULTI_COLUMN_LAYOUT_DETECTED" in document.warnings
        categories["MISSING_EVIDENCE"] += "EXPERIENCE_EVIDENCE_UNRESOLVED" in result.warnings
        warnings.update(document.warnings)
        warnings.update(result.warnings)

    return {
        "files": total["files"],
        "parsed": total["parsed"],
        "needsOcr": total["needs_ocr"],
        "parseErrors": total["parse_errors"],
        "fieldCoverage": {
            "contact": total["has_contact"],
            "skills": total["has_skills"],
            "education": total["has_education"],
            "experience": total["has_experience"],
        },
        "manualReview": total["manual_review"],
        "extractionMethods": dict(sorted(methods.items())),
        "diagnostics": dict(sorted(warnings.items())),
        "diagnosticCategories": dict(sorted(categories.items())),
        "qualityGate": {
            "productionReady": False,
            "reason": "Set only after anonymized expected-result accuracy meets the agreed threshold.",
            "minimumFixtureAccuracy": 0.90,
        },
    }


def evaluate_fixture(path: Path) -> dict[str, object]:
    cases = json.loads(path.read_text(encoding="utf-8"))
    parser = StructuredCvParser()
    fields = ("contact", "skills", "education", "experience")
    correct: Counter[str] = Counter()
    total: Counter[str] = Counter()
    for case in cases:
        result = parser.parse_with_diagnostics(case["text"])
        actual = {
            "contact": bool(result.candidate.email or result.candidate.phone),
            "skills": bool(result.candidate.skills),
            "education": bool(result.candidate.education),
            "experience": bool(result.candidate.work_experience),
        }
        for field in fields:
            total[field] += 1
            correct[field] += actual[field] == case["expected"][field]
    accuracy = {field: round(correct[field] / total[field], 3) for field in fields}
    return {"cases": len(cases), "fieldAccuracy": accuracy, "meetsMinimum": all(value >= 0.90 for value in accuracy.values())}


def main() -> None:
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("directory", type=Path)
    arguments.add_argument("--include-ocr", action="store_true")
    arguments.add_argument("--json-out", type=Path)
    arguments.add_argument("--fixture", type=Path, default=Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "parser_benchmark.json")
    options = arguments.parse_args()
    report = run(options.directory, include_ocr=options.include_ocr)
    report["fixtureBenchmark"] = evaluate_fixture(options.fixture)
    payload = json.dumps(report, ensure_ascii=False, indent=2)
    if options.json_out:
        options.json_out.write_text(payload + "\n", encoding="utf-8")
    print(payload)


if __name__ == "__main__":
    main()
