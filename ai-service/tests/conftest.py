import json
from pathlib import Path
from typing import Any

import pytest

from app.api.matching import get_semantic_matcher
from app.core.dependencies import require_test_endpoint_access
from app.main import app
from tests.support import ApiTestClient


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
def client() -> ApiTestClient:
    app.dependency_overrides[get_semantic_matcher] = lambda: StubSemanticMatcher()
    app.dependency_overrides[require_test_endpoint_access] = lambda: None
    try:
        yield ApiTestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def load_fixture() -> Any:
    fixture_dir = Path(__file__).parent / "fixtures"

    def load(name: str) -> dict[str, Any]:
        return json.loads((fixture_dir / name).read_text(encoding="utf-8"))

    return load
