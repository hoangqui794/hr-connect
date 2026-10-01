from app.schemas.matching_response import RequirementMatch


class ExplanationService:
    def generate(
        self,
        must_have: list[RequirementMatch],
        should_have: list[RequirementMatch],
        semantic_score: float,
        semantic_threshold: float,
    ) -> tuple[list[str], list[str], list[str]]:
        all_results = [*must_have, *should_have]
        highlights = [
            f"Candidate matches {item.requirement} requirement"
            for item in all_results
            if item.matched
        ]
        highlights.extend(
            f"Candidate partially matches {item.requirement} requirement ({item.evidence_coverage:.0%} evidence coverage)"
            for item in all_results
            if item.match_status == "PARTIAL"
        )
        missing = [
            f"{item.requirement} requirement was not found"
            for item in all_results
            if item.match_status == "NOT_FOUND"
        ]
        missing.extend(
            f"{item.requirement} is missing: {', '.join(item.missing_evidence)}"
            for item in all_results
            if item.match_status == "PARTIAL" and item.missing_evidence
        )
        reasons = [
            f"Matched {sum(item.matched for item in must_have)} of {len(must_have)} MUST_HAVE requirements; "
            f"partial evidence: {sum(item.match_status == 'PARTIAL' for item in must_have)}",
            f"Matched {sum(item.matched for item in should_have)} of {len(should_have)} SHOULD_HAVE requirements; "
            f"partial evidence: {sum(item.match_status == 'PARTIAL' for item in should_have)}",
        ]
        relation = "meets" if semantic_score >= semantic_threshold else "is below"
        reasons.append(
            f"Semantic similarity {semantic_score:.4f} {relation} the experimental threshold "
            f"{semantic_threshold:.4f}"
        )
        return highlights, missing, reasons
