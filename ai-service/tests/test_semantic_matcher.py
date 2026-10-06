import numpy as np

from app.schemas.matching_request import MatchingRequest
from app.services.semantic_matcher import SemanticMatcher


class FakeEmbeddingModel:
    def encode(self, sentences: list[str], **kwargs: object) -> np.ndarray:
        first = sentences[0].casefold()
        second = sentences[1].casefold()
        backend_terms = ("rest", "backend", ".net", "api")
        first_strength = sum(term in first for term in backend_terms)
        second_strength = sum(term in second for term in backend_terms)
        return np.array([[first_strength, 1.0], [second_strength, 1.0]], dtype=float)


def test_semantic_matcher_detects_equivalent_wording(load_fixture) -> None:
    payload = load_fixture("strong_match.json")
    payload["candidate"]["cvText"] = "Built REST APIs using ASP.NET Core"
    payload["job"]["description"] = "Experience developing RESTful backend services using .NET"
    request = MatchingRequest.model_validate(payload)

    score = SemanticMatcher(FakeEmbeddingModel()).calculate_similarity(request)

    assert 0.8 <= score <= 1.0


def test_semantic_matcher_supports_vietnamese_and_english_input(load_fixture) -> None:
    payload = load_fixture("strong_match.json")
    payload["candidate"]["cvText"] = "Phát triển API backend bằng ASP.NET Core"
    payload["job"]["description"] = "Develop REST API backend services with .NET"
    request = MatchingRequest.model_validate(payload)

    score = SemanticMatcher(FakeEmbeddingModel()).calculate_similarity(request)

    assert 0 <= score <= 1
