from collections.abc import Iterable

from app.schemas.cv import ParseDiagnostic


_FIELD_PREFIXES = {
    "EXPERIENCE": "experience",
    "EMPLOYER": "experience",
    "EDUCATION": "education",
    "ACADEMIC": "education",
    "SKILL": "skills",
    "CONTACT": "contact",
    "EMAIL": "contact",
    "PHONE": "contact",
    "PROJECT": "projects",
    "CERTIFICATION": "certifications",
    "LANGUAGE": "languages",
}

_GLOBAL_UNREADABLE_CODES = {
    "NO_SECTIONS_DETECTED",
    "OCR_LAYOUT_UNSTRUCTURED",
    "OCR_POSITION_DATA_UNAVAILABLE",
    "EXTRACTED_TEXT_TRUNCATED",
}


def build_parse_diagnostics(extracted, warnings: Iterable[str]) -> list[ParseDiagnostic]:
    """Build non-PII diagnostics shared by direct and background parsing."""
    diagnostics = [
        ParseDiagnostic(
            code="OCR_APPLIED" if extracted.ocr_applied else "TEXT_LAYER_USED",
            category="OCR" if extracted.ocr_applied else "TEXT_LAYER",
        ),
        ParseDiagnostic(code=f"LAYOUT_{extracted.layout}", category="LAYOUT"),
    ]
    for warning in warnings:
        field = _diagnostic_field(warning)
        if field is not None or warning.endswith("NOT_DETECTED"):
            category = "MISSING_EVIDENCE"
        elif warning.startswith("OCR"):
            category = "OCR"
        elif warning.startswith(("LAYOUT", "MULTI_COLUMN", "SECTION_ROUTING")):
            category = "LAYOUT"
        else:
            category = "PARSER"
        diagnostics.append(ParseDiagnostic(code=warning, category=category, field=field))
    return diagnostics


def unreliable_evidence_fields(diagnostics: Iterable[ParseDiagnostic]) -> list[str]:
    """Return coarse field names only when parser evidence was genuinely unreadable."""
    fields: set[str] = set()
    for diagnostic in diagnostics:
        if diagnostic.code in _GLOBAL_UNREADABLE_CODES:
            fields.add("all")
        elif diagnostic.category == "MISSING_EVIDENCE" and diagnostic.field:
            fields.add(diagnostic.field)
    return sorted(fields)


def _diagnostic_field(code: str) -> str | None:
    return next(
        (field for prefix, field in _FIELD_PREFIXES.items() if code.startswith(prefix)),
        None,
    )
