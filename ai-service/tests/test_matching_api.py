from typing import Any

from fastapi.testclient import TestClient


def _contains_decision(value: Any) -> bool:
    if isinstance(value, dict):
        return any(key.casefold() == "decision" or _contains_decision(item) for key, item in value.items())
    if isinstance(value, list):
        return any(_contains_decision(item) for item in value)
    return value in {"SHORTLIST", "REJECT", "HIRE"}


def test_strong_medium_poor_ranking(client: TestClient, load_fixture) -> None:
    responses = [
        client.post("/api/v1/match", json=load_fixture(name))
        for name in ("strong_match.json", "medium_match.json", "poor_match.json")
    ]

    assert [response.status_code for response in responses] == [200, 200, 200]
    strong, medium, poor = [response.json() for response in responses]
    assert strong["matchScore"] > medium["matchScore"] > poor["matchScore"]
    assert not any(_contains_decision(result) for result in (strong, medium, poor))
    assert strong["status"] == "COMPLETED"
    assert strong["modelName"] == "BAAI/bge-m3"


def test_missing_must_have_appears_in_explanation(client: TestClient, load_fixture) -> None:
    response = client.post("/api/v1/match", json=load_fixture("missing_must_have.json"))

    assert response.status_code == 200
    body = response.json()
    redis = next(item for item in body["mustHaveResult"] if item["requirement"] == "redis")
    assert redis["matched"] is False
    assert "redis requirement was not found" in body["missingRequirements"]
    assert not _contains_decision(body)


def test_unrelated_cv_scores_below_related_candidate(client: TestClient, load_fixture) -> None:
    related = client.post("/api/v1/match", json=load_fixture("strong_match.json")).json()
    unrelated_payload = load_fixture("poor_match.json")
    unrelated_payload["candidate"]["summary"] = "Unrelated visual artist"
    unrelated = client.post("/api/v1/match", json=unrelated_payload).json()

    assert unrelated["matchScore"] < related["matchScore"]
    assert len(unrelated["missingRequirements"]) == 3


def test_same_meaning_with_different_wording(client: TestClient, load_fixture) -> None:
    payload = load_fixture("medium_match.json")
    payload["candidate"]["cvText"] = "Created RESTful server-side services with the Microsoft .NET platform."
    response = client.post("/api/v1/match", json=payload)

    assert response.status_code == 200
    assert response.json()["semanticScore"] == 0.60


def test_vietnamese_cv_with_english_job(client: TestClient, load_fixture) -> None:
    payload = load_fixture("strong_match.json")
    payload["candidate"]["cvText"] = "Phát triển dịch vụ backend và REST API bằng ASP.NET Core."
    response = client.post("/api/v1/match", json=payload)

    assert response.status_code == 200
    assert response.json()["semanticScore"] == 0.90


def test_english_cv_with_vietnamese_job(client: TestClient, load_fixture) -> None:
    payload = load_fixture("strong_match.json")
    payload["job"]["description"] = "Phát triển dịch vụ backend bằng .NET và PostgreSQL."
    response = client.post("/api/v1/match", json=payload)

    assert response.status_code == 200
    assert response.json()["semanticScore"] == 0.90


def test_invalid_attempt_no(client: TestClient, load_fixture) -> None:
    payload = load_fixture("strong_match.json")
    payload["attemptNo"] = 0

    response = client.post("/api/v1/match", json=payload)

    assert response.status_code == 422


def test_empty_cv_is_rejected(client: TestClient, load_fixture) -> None:
    payload = load_fixture("strong_match.json")
    payload["candidate"]["cvText"] = "   "

    response = client.post("/api/v1/match", json=payload)

    assert response.status_code == 422


def test_invalid_request_is_rejected(client: TestClient) -> None:
    response = client.post("/api/v1/match", json={"requestId": "X"})

    assert response.status_code == 422
