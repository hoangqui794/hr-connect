import numpy as np

from app.schemas.matching_request import MatchingRequest
from app.services.semantic_matcher import SemanticMatcher


class FakeEmbeddingModel:
    def encode(self, sentences: list[str], **kwargs: object) -> np.ndarray:
        backend_terms = ("rest", "backend", ".net", "api")
        rows = [[sum(term in sentence.casefold() for term in backend_terms), 1.0] for sentence in sentences]
        return np.array(rows, dtype=float)


def test_semantic_matcher_detects_equivalent_wording(load_fixture) -> None:
    payload = load_fixture("strong_match.json")
    payload["candidate"]["cvText"] = "Built REST APIs using ASP.NET Core"
    payload["job"]["description"] = "Experience developing RESTful backend services using .NET"
    # Each requirement is its own job chunk; keep only the one this fake can score.
    payload["job"]["requirements"] = [{"type": "MUST_HAVE", "category": "SKILL", "content": "REST API backend"}]
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


class KeywordEmbeddingModel:
    """One axis per keyword; a model with a hard input cap would miss late text."""

    KEYWORDS = ("kubernetes", "nurse", "accounting")

    def encode(self, sentences: list[str], **kwargs: object) -> np.ndarray:
        rows = []
        for sentence in sentences:
            visible = sentence.casefold()[:400]
            vector = [float(keyword in visible) for keyword in self.KEYWORDS] + [0.05]
            rows.append(np.array(vector) / np.linalg.norm(vector))
        return np.array(rows)


def test_semantic_matcher_reads_evidence_at_the_end_of_a_long_cv(load_fixture) -> None:
    payload = load_fixture("strong_match.json")
    filler = "\n".join(f"Handled routine office task number {index}." for index in range(80))
    payload["candidate"]["cvText"] = f"{filler}\nOperated Kubernetes clusters in production."
    payload["candidate"]["summary"] = "Experienced engineer"
    payload["candidate"]["skills"] = []
    payload["job"]["title"] = "Platform engineer"
    payload["job"]["description"] = "Run Kubernetes clusters."
    payload["job"]["requirements"] = [{"type": "MUST_HAVE", "category": "SKILL", "content": "Kubernetes"}]
    request = MatchingRequest.model_validate(payload)

    score = SemanticMatcher(KeywordEmbeddingModel()).calculate_similarity(request)

    assert score >= 0.9
