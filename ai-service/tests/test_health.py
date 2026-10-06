from app import main
from tests.support import ApiTestClient


def test_health(client: ApiTestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "hr-connect-ai"}


def test_readiness_reports_ready_with_integration_configuration(monkeypatch) -> None:
    settings = main.get_settings().model_copy(
        update={
            "hrconnect_service_token": "test-service-token-with-safe-length",
            "hrconnect_base_url": "https://localhost:7289",
        }
    )
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    application = main.create_app()

    response = ApiTestClient(application).get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "service": "hr-connect-ai"}


def test_readiness_reports_missing_service_token(monkeypatch) -> None:
    settings = main.get_settings().model_copy(update={"hrconnect_service_token": ""})
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    application = main.create_app()

    response = ApiTestClient(application).get("/ready")

    assert response.status_code == 503
    assert response.json()["missing"] == ["HRCONNECT_SERVICE_TOKEN"]
