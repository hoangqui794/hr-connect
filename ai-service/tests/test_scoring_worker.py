import asyncio
import re

from app.schemas.matching_request import Job
from app.schemas.scoring_job import ScoringJobRequest
from app.services.document_parser import ExtractedDocument
from app.services.scoring_orchestrator import ScoringOrchestrator


class _Client:
    def __init__(self) -> None:
        self.payload: dict | None = None

    async def post_ai_result(self, payload: dict) -> None:
        self.payload = payload

    async def get_cv_metadata(self, _: str) -> dict:
        return {
            "fileName": "candidate.pdf",
            "mimeType": "application/pdf",
            "downloadUrl": "https://storage.example/private-cv",
        }

    async def download_cv(self, _: str) -> bytes:
        return b"private-cv-bytes"

    async def get_job(self, _: str) -> Job:
        return Job.model_validate(
            {
                "title": "Backend Developer",
                "description": "Build backend services",
                "requirements": [
                    {
                        "type": "MUST_HAVE",
                        "category": "EXPERIENCE",
                        "content": "At least 3 years experience",
                        "minYears": 3,
                    }
                ],
            }
        )


def test_failed_callback_sends_error_code() -> None:
    client = _Client()
    orchestrator = ScoringOrchestrator(client=client)
    job = ScoringJobRequest.model_validate(
        {
            "requestId": "request-001",
            "applicationId": "11111111-1111-1111-1111-111111111111",
            "cvId": "22222222-2222-2222-2222-222222222222",
            "jobId": "33333333-3333-3333-3333-333333333333",
            "attemptNo": 1,
        }
    )

    asyncio.run(orchestrator.callback_failed(job, "OCR_FAILED", "Unable to read CV"))

    assert client.payload is not None
    assert client.payload["status"] == "FAILED"
    assert client.payload["errorCode"] == "OCR_FAILED"
    assert client.payload["errorMessage"] == "Unable to read CV"


def test_background_scoring_sends_diagnostics_match_metadata_and_fingerprints(
    monkeypatch,
) -> None:
    from app.services import scoring_orchestrator

    class _Parser:
        def parse(self, *_args) -> ExtractedDocument:
            return ExtractedDocument(
                text=(
                    "NGUYEN VAN A\nEXPERIENCE\nBackend Developer\n"
                    "Built APIs with Python."
                ),
                media_type="application/pdf",
                page_count=1,
                extraction_method="PDF_TEXT",
                ocr_applied=False,
                warnings=["MULTI_COLUMN_LAYOUT_DETECTED"],
                layout="MULTI_COLUMN",
            )

    class _SemanticMatcher:
        def calculate_similarity(self, _request) -> float:
            return 0.5

        def retrieve_evidence(self, requirements, _cv_text):
            return [[] for _ in requirements]

    monkeypatch.setattr(scoring_orchestrator, "get_document_parser", lambda: _Parser())
    monkeypatch.setattr(
        scoring_orchestrator, "get_semantic_matcher", lambda: _SemanticMatcher()
    )
    client = _Client()
    orchestrator = ScoringOrchestrator(client=client)
    job = ScoringJobRequest.model_validate(
        {
            "requestId": "request-002",
            "applicationId": "11111111-1111-1111-1111-111111111111",
            "cvId": "22222222-2222-2222-2222-222222222222",
            "jobId": "33333333-3333-3333-3333-333333333333",
            "attemptNo": 1,
        }
    )

    asyncio.run(orchestrator.process(job))

    payload = client.payload
    assert payload is not None
    assert payload["status"] == "COMPLETED"
    assert payload["parseConfidence"] <= 1
    assert payload["requiresManualReview"] is True
    assert {item["category"] for item in payload["diagnostics"]} >= {
        "TEXT_LAYER",
        "LAYOUT",
    }
    assert payload["semanticScore"] == 0.5
    assert payload["missingRequirements"]
    assert payload["matchingReasons"]
    assert re.fullmatch(r"[0-9a-f]{64}", payload["inputFingerprints"]["cvSha256"])
    assert re.fullmatch(r"[0-9a-f]{64}", payload["inputFingerprints"]["jdSha256"])
    serialized_metadata = str(
        {
            "warnings": payload["warnings"],
            "diagnostics": payload["diagnostics"],
            "inputFingerprints": payload["inputFingerprints"],
        }
    )
    assert "private-cv-bytes" not in serialized_metadata
    assert "storage.example" not in serialized_metadata
