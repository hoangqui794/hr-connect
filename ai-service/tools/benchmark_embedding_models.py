"""Compare embedding models on labeled CV/JD pairs (local-only, anonymized data).

Scores every pair through ``SemanticMatcher.calculate_similarity`` so the text
assembly matches production, then reports load time, per-pair latency, how well
the scores separate relevant from irrelevant pairs, and the threshold that best
splits them.

    python tools/benchmark_embedding_models.py BAAI/bge-m3 \
        sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sentence_transformers import SentenceTransformer

from app.schemas.matching_request import MatchingRequest
from app.services.semantic_matcher import SemanticMatcher

_DEFAULT_DATASET = Path(__file__).with_name("embedding_benchmark_pairs.json")


def _build_requests(dataset: dict) -> list[tuple[MatchingRequest, bool]]:
    requests = []
    for index, pair in enumerate(dataset["pairs"]):
        job = dataset["jobs"][pair["job"]]
        candidate = dataset["candidates"][pair["candidate"]]
        payload = {
            "requestId": f"BENCH-{index}",
            "applicationId": f"BENCH-APP-{index}",
            "attemptNo": 1,
            "candidate": {
                "summary": candidate["summary"],
                "skills": [{"name": skill} for skill in candidate["skills"]],
                "cvText": candidate["cvText"],
            },
            "job": {
                "title": job["title"],
                "description": job["description"],
                "requirements": [
                    {"type": "MUST_HAVE", "category": "SKILL", "content": item} for item in job["requirements"]
                ],
            },
        }
        requests.append((MatchingRequest.model_validate(payload), bool(pair["relevant"])))
    return requests


def _best_threshold(scored: list[tuple[float, bool]]) -> tuple[float, float]:
    best = (0.0, 0.0)
    for candidate in sorted({score for score, _ in scored}):
        correct = sum((score >= candidate) == relevant for score, relevant in scored)
        accuracy = correct / len(scored)
        if accuracy > best[1]:
            best = (candidate, accuracy)
    return best


def benchmark(model_name: str, requests: list[tuple[MatchingRequest, bool]]) -> dict:
    started = time.perf_counter()
    matcher = SemanticMatcher(SentenceTransformer(model_name))
    load_seconds = time.perf_counter() - started
    matcher.calculate_similarity(requests[0][0])  # warm-up, excluded from latency

    scored, latencies = [], []
    for request, relevant in requests:
        started = time.perf_counter()
        scored.append((matcher.calculate_similarity(request), relevant))
        latencies.append(time.perf_counter() - started)

    relevant_scores = [score for score, relevant in scored if relevant]
    other_scores = [score for score, relevant in scored if not relevant]
    threshold, accuracy = _best_threshold(scored)
    latencies.sort()
    return {
        "model": model_name,
        "loadSeconds": round(load_seconds, 2),
        "latencyP50Ms": round(statistics.median(latencies) * 1000, 1),
        "latencyP95Ms": round(latencies[min(len(latencies) - 1, int(len(latencies) * 0.95))] * 1000, 1),
        "meanRelevant": round(statistics.mean(relevant_scores), 4),
        "meanIrrelevant": round(statistics.mean(other_scores), 4),
        "minRelevant": round(min(relevant_scores), 4),
        "maxIrrelevant": round(max(other_scores), 4),
        "separationGap": round(statistics.mean(relevant_scores) - statistics.mean(other_scores), 4),
        "bestThreshold": threshold,
        "accuracyAtBestThreshold": round(accuracy, 4),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare embedding models on labeled CV/JD pairs")
    parser.add_argument("models", nargs="+", help="Hugging Face model names")
    parser.add_argument("--dataset", type=Path, default=_DEFAULT_DATASET)
    args = parser.parse_args()

    requests = _build_requests(json.loads(args.dataset.read_text(encoding="utf-8")))
    results = [benchmark(model, requests) for model in args.models]
    print(json.dumps({"pairs": len(requests), "results": results}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
