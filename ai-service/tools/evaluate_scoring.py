"""Measure AI scoring against HR-labelled cases, and optionally calibrate weights.

Each case is sent through the real /api/v1/match or /api/v1/match-file route
in-process, so parsing, rule matching, semantic scoring and partial credit are
exactly what production runs. Nothing leaves the machine.

    python tools/evaluate_scoring.py evaluation/example_manifest.json
    python tools/evaluate_scoring.py evaluation/private/manifest.json --calibrate

Manifest format: see evaluation/README.md.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from itertools import product
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.core.dependencies import require_test_endpoint_access
from app.main import app

_TIERS = ((80, ">=80"), (70, "70-79"), (60, "60-69"), (0, "<60"))


def tier(score: float) -> str:
    return next(label for floor, label in _TIERS if score >= floor)


def _resolve(base: Path, value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else base / path


def _load_job(case: dict, base: Path) -> dict:
    job = case["job"]
    if isinstance(job, str):
        job = json.loads(_resolve(base, job).read_text(encoding="utf-8"))
    # Accept either a bare job or a full matching payload that contains one.
    return job.get("job", job)


async def _score(client: httpx.AsyncClient, case: dict, base: Path) -> dict:
    job = _load_job(case, base)
    meta = {"requestId": f"EVAL-{case['id']}", "applicationId": f"EVAL-{case['id']}", "attemptNo": 1, "job": job}
    cv = case["cv"]
    if "file" in cv:
        path = _resolve(base, cv["file"])
        files = {"file": (path.name, path.read_bytes())}
        response = await client.post("/api/v1/match-file", files=files, data={"metadata": json.dumps(meta)})
        response.raise_for_status()
        result = response.json()["matchingResult"]
    else:
        payload = {**meta, "candidate": cv["candidate"]}
        response = await client.post("/api/v1/match", json=payload)
        response.raise_for_status()
        result = response.json()
    return {"job": job, "result": result}


def _requirement_statuses(job: dict, result: dict) -> dict[str, str]:
    """Map requirement ids to AI status; results keep the job's order per type."""
    statuses: dict[str, str] = {}
    for kind, key in (("MUST_HAVE", "mustHaveResult"), ("SHOULD_HAVE", "shouldHaveResult")):
        requirements = [item for item in job["requirements"] if item["type"] == kind]
        for index, (requirement, match) in enumerate(zip(requirements, result[key])):
            statuses[requirement.get("id", f"{kind}-{index + 1}")] = match["matchStatus"]
    return statuses


def _components(result: dict) -> tuple[float, float, float]:
    def ratio(items: list[dict]) -> float:
        return sum(item["evidenceCoverage"] for item in items) / len(items) if items else 1.0

    return ratio(result["mustHaveResult"]), ratio(result["shouldHaveResult"]), result["semanticScore"]


def _calibrate(rows: list[tuple[tuple[float, float, float], float]]) -> list[dict]:
    """Grid-search weights (step 0.05, sum 1) by mean absolute error to HR scores."""
    grid = [round(step * 0.05, 2) for step in range(21)]
    ranked = []
    for must, should in product(grid, grid):
        semantic = round(1 - must - should, 2)
        if semantic < 0:
            continue
        predictions = [100 * (must * m + should * s + semantic * e) for (m, s, e), _ in rows]
        labels = [label for _, label in rows]
        mae = sum(abs(p - l) for p, l in zip(predictions, labels)) / len(rows)
        agreement = sum(tier(p) == tier(l) for p, l in zip(predictions, labels)) / len(rows)
        ranked.append({"mustHaveWeight": must, "shouldHaveWeight": should, "semanticWeight": semantic,
                       "mae": round(mae, 2), "tierAgreement": round(agreement, 3)})
    ranked.sort(key=lambda item: (item["mae"], -item["tierAgreement"]))
    return ranked[:5]


async def _run(manifest: Path, calibrate: bool) -> dict:
    data = json.loads(manifest.read_text(encoding="utf-8"))
    base = manifest.parent
    app.dependency_overrides[require_test_endpoint_access] = lambda: None
    cases, rows = [], []
    requirement_total = requirement_agree = 0
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://evaluation", timeout=300) as client:
            for case in data["cases"]:
                scored = await _score(client, case, base)
                result, label = scored["result"], case["label"]
                ai_status = _requirement_statuses(scored["job"], result)
                disagreements = {
                    rid: {"hr": expected, "ai": ai_status.get(rid)}
                    for rid, expected in label.get("requirements", {}).items()
                    if ai_status.get(rid) != expected
                }
                requirement_total += len(label.get("requirements", {}))
                requirement_agree += len(label.get("requirements", {})) - len(disagreements)
                cases.append({
                    "id": case["id"], "aiScore": result["matchScore"], "hrScore": label["score"],
                    "difference": round(result["matchScore"] - label["score"], 2),
                    "aiTier": tier(result["matchScore"]), "hrTier": tier(label["score"]),
                    "semanticScore": result["semanticScore"], "requirementDisagreements": disagreements,
                })
                rows.append((_components(result), label["score"]))
    finally:
        app.dependency_overrides.clear()

    settings = get_settings()
    report = {
        "model": settings.embedding_model,
        "weights": [settings.must_have_weight, settings.should_have_weight, settings.semantic_weight],
        "cases": cases,
        "summary": {
            "cases": len(cases),
            "meanAbsoluteError": round(sum(abs(c["difference"]) for c in cases) / len(cases), 2),
            "tierAgreement": round(sum(c["aiTier"] == c["hrTier"] for c in cases) / len(cases), 3),
            "requirementAgreement": round(requirement_agree / requirement_total, 3) if requirement_total else None,
        },
    }
    if calibrate:
        report["recommendedWeights"] = _calibrate(rows)
        report["calibrationNote"] = (
            "Recommendations only; review them and set MUST_HAVE_WEIGHT/SHOULD_HAVE_WEIGHT/SEMANTIC_WEIGHT. "
            "With few cases they overfit."
        )
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare AI scores with HR labels")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--calibrate", action="store_true", help="also grid-search scoring weights")
    args = parser.parse_args()
    report = asyncio.run(_run(args.manifest.resolve(), args.calibrate))
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
