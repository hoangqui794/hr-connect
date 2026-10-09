"""Compare stored AI scores with what HR actually decided.

Input is the CSV produced by evaluation/hr_feedback.sql. Reports, per score
tier, how often HR shortlisted or rejected, plus the cases where AI and HR
disagree most (high score rejected, low score shortlisted) for manual review.

    python tools/hr_feedback_report.py hr_feedback.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from evaluate_scoring import tier  # noqa: E402


def build_report(rows: list[dict], high: float = 80, low: float = 60, limit: int = 20) -> dict:
    by_tier: dict[str, Counter] = defaultdict(Counter)
    reasons: dict[str, Counter] = defaultdict(Counter)
    for row in rows:
        score = float(row["match_score"])
        label = tier(score)
        by_tier[label][row["hr_decision"]] += 1
        if row["hr_decision"] == "REJECTED" and row.get("reject_reason_code"):
            reasons[label][row["reject_reason_code"]] += 1

    tiers = {}
    for label in (">=80", "70-79", "60-69", "<60"):
        counts = by_tier.get(label, Counter())
        decided = counts["SHORTLISTED"] + counts["REJECTED"]
        tiers[label] = {
            "total": sum(counts.values()),
            "shortlisted": counts["SHORTLISTED"],
            "rejected": counts["REJECTED"],
            "undecided": counts["UNDECIDED"],
            "shortlistRate": round(counts["SHORTLISTED"] / decided, 3) if decided else None,
            "topRejectReasons": dict(reasons[label].most_common(3)),
        }

    def disagreement(row: dict) -> bool:
        score = float(row["match_score"])
        return (row["hr_decision"] == "REJECTED" and score >= high) or (
            row["hr_decision"] == "SHORTLISTED" and score < low
        )

    flagged = sorted(
        (row for row in rows if disagreement(row)),
        key=lambda row: abs(float(row["match_score"]) - (0 if row["hr_decision"] == "REJECTED" else 100)),
        reverse=True,
    )
    return {
        "applications": len(rows),
        "byTier": tiers,
        # A healthy model shows shortlist rates falling from the top tier down.
        "monotonic": _is_monotonic([tiers[label]["shortlistRate"] for label in tiers]),
        "disagreements": [
            {key: row.get(key) for key in ("application_id", "match_score", "hr_decision", "reject_reason_code", "model_version")}
            for row in flagged[:limit]
        ],
    }


def _is_monotonic(rates: list[float | None]) -> bool | None:
    known = [rate for rate in rates if rate is not None]
    if len(known) < 2:
        return None
    return all(left >= right for left, right in zip(known, known[1:]))


def main() -> int:
    parser = argparse.ArgumentParser(description="AI score vs HR decision report")
    parser.add_argument("csv_file", type=Path)
    parser.add_argument("--limit", type=int, default=20, help="max disagreements to list")
    args = parser.parse_args()
    with args.csv_file.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    print(json.dumps(build_report(rows, limit=args.limit), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
