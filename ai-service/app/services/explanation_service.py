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
        missing = [
            f"{item.requirement} requirement was not found"
            for item in all_results
            if not item.matched
        ]
        reasons = [
            f"Matched {sum(item.matched for item in must_have)} of {len(must_have)} MUST_HAVE requirements",
            f"Matched {sum(item.matched for item in should_have)} of {len(should_have)} SHOULD_HAVE requirements",
        ]
        relation = "meets" if semantic_score >= semantic_threshold else "is below"
        reasons.append(
            f"Semantic similarity {semantic_score:.4f} {relation} the experimental threshold "
            f"{semantic_threshold:.4f}"
        )
        return highlights, missing, reasons
