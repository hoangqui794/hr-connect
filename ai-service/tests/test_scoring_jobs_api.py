from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.api import scoring_jobs


def test_scoring_job_rejects_missing_internal_key(client: TestClient) -> None:
    response = client.post("/api/v1/scoring-jobs", json=_payload())

    assert response.status_code == 401


def test_scoring_job_rejects_invalid_service_token(
    client: TestClient, monkeypatch,
) -> None:
    monkeypatch.setattr(
        scoring_jobs,
        "get_settings",
        lambda: SimpleNamespace(hrconnect_service_token="secret"),
    )

    response = client.post(
        "/api/v1/scoring-jobs",
        headers={"X-Service-Token": "wrong-secret"},
        json=_payload(),
    )

    assert response.status_code == 401


def test_scoring_job_accepts_valid_internal_key(
    client: TestClient, monkeypatch,
) -> None:
    enqueue = AsyncMock(return_value=True)
    monkeypatch.setattr(
        scoring_jobs,
        "get_settings",
        lambda: SimpleNamespace(hrconnect_service_token="secret"),
    )
    monkeypatch.setattr(scoring_jobs.scoring_job_queue, "enqueue", enqueue)

    response = client.post(
        "/api/v1/scoring-jobs",
        headers={"X-Service-Token": "secret"},
        json=_payload(),
    )

    assert response.status_code == 202
    assert response.json() == {"requestId": "request-001", "status": "ACCEPTED"}
    enqueue.assert_awaited_once()


def _payload() -> dict[str, object]:
    return {
        "requestId": "request-001",
        "applicationId": "11111111-1111-1111-1111-111111111111",
        "cvId": "22222222-2222-2222-2222-222222222222",
        "jobId": "33333333-3333-3333-3333-333333333333",
        "attemptNo": 1,
    }
