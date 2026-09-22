import json

from fastapi.testclient import TestClient

from app.api.cv import get_document_parser
from app.main import app
from app.services.document_parser import CvProcessingError, ExtractedDocument


class StubDocumentParser:
    def parse(self, filename: str, declared_media_type: str | None, data: bytes) -> ExtractedDocument:
        return ExtractedDocument(
            text="""NGUYEN VAN AN
Tóm tắt
Strong backend developer
Kỹ năng
ASP.NET Core, PostgreSQL, Docker
Kinh nghiệm
Backend Developer | 2020 - 2023
Học vấn
Kỹ sư phần mềm
""",
            media_type="application/pdf",
            page_count=1,
            extraction_method="PDF_TEXT",
            ocr_applied=False,
        )


class FailingDocumentParser:
    def __init__(self, error: Exception) -> None:
        self.error = error

    def parse(self, filename: str, declared_media_type: str | None, data: bytes) -> ExtractedDocument:
        raise self.error


def _upload() -> dict[str, tuple[str, bytes, str]]:
    return {"file": ("candidate.pdf", b"%PDF-fake", "application/pdf")}


def _metadata() -> dict:
    return {
        "requestId": "file-test-001",
        "applicationId": "application-001",
        "attemptNo": 1,
        "job": {
            "title": "Backend .NET Developer",
            "description": "Build recruitment APIs",
            "requirements": [
                {"type": "MUST_HAVE", "category": "SKILL", "content": "ASP.NET Core"},
                {"type": "MUST_HAVE", "category": "SKILL", "content": "PostgreSQL"},
                {"type": "SHOULD_HAVE", "category": "SKILL", "content": "Docker"},
            ],
        },
    }


def test_parse_cv_returns_raw_and_structured_data(client: TestClient) -> None:
    app.dependency_overrides[get_document_parser] = lambda: StubDocumentParser()

    response = client.post("/api/v1/cv/parse", files=_upload())

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "COMPLETED"
    assert body["document"]["extractionMethod"] == "PDF_TEXT"
    assert body["candidate"]["fullName"] == "NGUYEN VAN AN"
    assert 0 <= body["parseConfidence"] <= 1
    assert isinstance(body["requiresManualReview"], bool)
    assert {skill["name"] for skill in body["candidate"]["skills"]} >= {
        "asp.net core", "postgresql", "docker"
    }


def test_match_file_parses_then_scores_without_recruitment_decision(client: TestClient) -> None:
    app.dependency_overrides[get_document_parser] = lambda: StubDocumentParser()

    response = client.post(
        "/api/v1/match-file",
        files=_upload(),
        data={"metadata": json.dumps(_metadata())},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["matchingResult"]["status"] == "COMPLETED"
    assert body["matchingResult"]["matchScore"] > 0
    serialized = json.dumps(body).casefold()
    assert "decision" not in serialized
    assert "matchtier" not in serialized


def test_match_file_rejects_invalid_metadata(client: TestClient) -> None:
    response = client.post(
        "/api/v1/match-file",
        files=_upload(),
        data={"metadata": "not-json"},
    )

    assert response.status_code == 422


def test_cv_processing_error_keeps_specific_status(client: TestClient) -> None:
    app.dependency_overrides[get_document_parser] = lambda: FailingDocumentParser(
        CvProcessingError(415, "Unsupported CV format")
    )

    response = client.post("/api/v1/cv/parse", files=_upload())

    assert response.status_code == 415
    assert response.json()["detail"] == "Unsupported CV format"


def test_unexpected_cv_failure_returns_manual_review_503(client: TestClient) -> None:
    app.dependency_overrides[get_document_parser] = lambda: FailingDocumentParser(
        RuntimeError("OCR unavailable")
    )

    response = client.post("/api/v1/cv/parse", files=_upload())

    assert response.status_code == 503
    assert "manual review" in response.json()["detail"]
