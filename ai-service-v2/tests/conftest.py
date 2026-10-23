import pytest

from app.config import get_settings


@pytest.fixture(autouse=True)
def isolated_queue_file(tmp_path, monkeypatch):
    """Keep the persisted scoring queue out of the repo and ignore a developer .env during tests."""
    monkeypatch.setenv("SCORING_QUEUE_FILE", str(tmp_path / "pending-scoring-jobs.json"))
    # A developer .env may turn the docs on (API_DOCS_ENABLED=true); tests assume the safe default.
    monkeypatch.setenv("API_DOCS_ENABLED", "false")
    monkeypatch.setenv("ALLOW_UNAUTHENTICATED_TEST_ENDPOINTS", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
