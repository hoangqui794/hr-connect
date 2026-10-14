"""Score a labelled manifest with v2 and compare with HR labels (same manifest format and metrics as v1).

    python tools/evaluate.py ../ai-service/evaluation/private/manifest-senior-fullstack.json

Calls the real LLM: every case costs API tokens. Prints per-case results and a summary JSON.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.documents import prepare_document  # noqa: E402
from app.llm import LlmError, make_assessor  # noqa: E402
from app.pipeline import MatchingPipeline  # noqa: E402
from app.schemas import MatchingMetadata  # noqa: E402
from app.semantic import SemanticMatcher  # noqa: E402


def tier(score: float) -> str:
    return ">=80" if score >= 80 else "70-79" if score >= 70 else "60-69" if score >= 60 else "<60"


def load_job(base: Path, value) -> dict:
    payload = json.loads((base / value).read_text(encoding="utf-8")) if isinstance(value, str) else value
    return payload.get("job", payload)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--limit", type=int, default=0, help="Only the first N cases (cheap smoke run).")
    args = parser.parse_args()

    base = args.manifest.parent
    cases = json.loads(args.manifest.read_text(encoding="utf-8"))["cases"]
    if args.limit:
        cases = cases[: args.limit]

    settings = get_settings()
    pipeline = MatchingPipeline(settings, make_assessor(settings), SemanticMatcher(settings))
    rows, errors, agree, compared = [], [], 0, 0
    for case in cases:
        cv_path = base / case["cv"]["file"]
        metadata = MatchingMetadata.model_validate(
            {"requestId": case["id"], "applicationId": case["id"], "attemptNo": 1, "job": load_job(base, case["job"])}
        )
        started = time.perf_counter()
        try:
            result = pipeline.run(metadata, prepare_document(cv_path.name, cv_path.read_bytes()))
        except LlmError as exc:
            errors.append({"id": case["id"], "error": str(exc)})
            print(f"{case['id']}: LLM error: {exc}", flush=True)
            continue

        ai = {r.requirement.id: r.match_status.value for r in result.must_have_result + result.should_have_result}
        disagreements = {}
        for rid, hr in case["label"].get("requirements", {}).items():
            compared += 1
            if ai.get(rid) == hr:
                agree += 1
            else:
                disagreements[rid] = {"hr": hr, "ai": ai.get(rid)}
        hr_score = case["label"]["score"]
        rows.append({
            "id": case["id"], "aiScore": result.match_score, "hrScore": hr_score,
            "difference": round(result.match_score - hr_score, 2),
            "aiTier": tier(result.match_score), "hrTier": tier(hr_score),
            "seconds": round(time.perf_counter() - started, 1),
            "fitLevel": result.overall_fit.level,
            "manualReview": result.requires_manual_review, "requirementDisagreements": disagreements,
        })
        print(f"{case['id']}: AI {result.match_score:6.2f}  HR {hr_score:5}  fit {result.overall_fit.level}  {rows[-1]['seconds']}s  {list(disagreements)}", flush=True)

    summary = {
        "model": settings.active_model,
        "cases": len(rows),
        "llmErrors": len(errors),
        "avgSeconds": round(sum(r["seconds"] for r in rows) / len(rows), 1) if rows else None,
        "meanAbsoluteError": round(sum(abs(r["difference"]) for r in rows) / len(rows), 2) if rows else None,
        "tierAgreement": round(sum(r["aiTier"] == r["hrTier"] for r in rows) / len(rows), 3) if rows else None,
        "requirementAgreement": round(agree / compared, 3) if compared else None,
    }
    print(json.dumps({"summary": summary, "cases": rows, "errors": errors}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
