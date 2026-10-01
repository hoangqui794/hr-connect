"""Run a privacy-safe, local-only parser benchmark over a CV directory.

The command deliberately emits aggregate counts only.  It does not create a
copy of a CV, does not print filenames/raw text, and does not send data over
the network.  Use anonymized fixtures for deterministic regression assertions;
use this tool to see whether real local input has an unusual layout mix.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.dependencies import get_document_parser
from app.services.parser_evaluation import summarize_local_observations
from app.services.structured_cv_parser import StructuredCvParser


_SUPPORTED = {".pdf", ".docx", ".png", ".jpg", ".jpeg"}


def _pdf_requires_ocr(path: Path) -> bool:
    with pymupdf.open(path) as document:
        if document.page_count == 0:
            return True
        for page in document:
            text = page.get_text("text")
            if len("".join(character for character in text if character.isalnum())) < 40:
                return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Aggregate local CV-parser quality signals")
    parser.add_argument("directory", type=Path, help="Directory containing local CV files")
    parser.add_argument(
        "--include-ocr",
        action="store_true",
        help="Also process scans/images; this can be slow on CPU and may load OCR models.",
    )
    args = parser.parse_args()
    if not args.directory.is_dir():
        parser.error("directory must exist")

    document_parser = get_document_parser()
    structured_parser = StructuredCvParser()
    observations: list[dict[str, object]] = []
    for path in args.directory.rglob("*"):
        if not path.is_file() or path.suffix.casefold() not in _SUPPORTED:
            continue
        try:
            if not args.include_ocr and (
                path.suffix.casefold() in {".png", ".jpg", ".jpeg"}
                or (path.suffix.casefold() == ".pdf" and _pdf_requires_ocr(path))
            ):
                observations.append({"skippedOcr": True})
                continue
            extracted = document_parser.parse(path.name, None, path.read_bytes())
            result = structured_parser.parse_with_diagnostics(
                extracted.text,
                blocks=extracted.blocks,
                layout=extracted.layout,
                ocr_applied=extracted.ocr_applied,
            )
            observations.append({
                "layout": extracted.layout,
                "extractionMethod": extracted.extraction_method,
                "requiresManualReview": result.requires_manual_review,
                "warnings": result.warnings,
                "contact": bool(result.candidate.email or result.candidate.phone),
                "skills": bool(result.candidate.skills),
                "education": bool(result.candidate.education),
                "experience": bool(result.candidate.work_experience),
            })
        except Exception as exc:
            observations.append({"failureCode": type(exc).__name__})
    print(json.dumps(summarize_local_observations(observations), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
