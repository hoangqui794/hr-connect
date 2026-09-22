import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.matching import get_semantic_matcher
from app.main import app


class StubSemanticMatcher:
    def calculate_similarity(self, request: Any) -> float:
        summary = request.candidate.summary.casefold()
        if "strong" in summary:
            return 0.90
        if "medium" in summary:
            return 0.60
        if "poor" in summary or "unrelated" in summary:
            return 0.10
        return 0.75


@pytest.fixture
def client() -> TestClient:
    app.dependency_overrides[get_semantic_matcher] = lambda: StubSemanticMatcher()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def load_fixture() -> Any:
    fixture_dir = Path(__file__).parent / "fixtures"

    def load(name: str) -> dict[str, Any]:
        return json.loads((fixture_dir / name).read_text(encoding="utf-8"))

    return load
