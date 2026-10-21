import pytest

from app.config import get_settings


@pytest.fixture(autouse=True)
def isolated_queue_file(tmp_path, monkeypatch):
    """Keep the persisted scoring queue out of the repo during tests."""
    monkeypatch.setenv("SCORING_QUEUE_FILE", str(tmp_path / "pending-scoring-jobs.json"))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
