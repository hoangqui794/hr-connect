import asyncio

from app.schemas.scoring_job import ScoringJobRequest
from app.services.scoring_orchestrator import ScoringOrchestrator


class _Client:
    def __init__(self) -> None:
        self.payload: dict | None = None

    async def post_ai_result(self, payload: dict) -> None:
        self.payload = payload


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
