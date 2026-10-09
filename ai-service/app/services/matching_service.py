from app.core.config import get_settings
from app.schemas.matching_request import MatchingRequest
from app.schemas.matching_response import MatchingResponse, RequirementMatch
from app.services.explanation_service import ExplanationService
from app.services.normalizer import normalize_request
from app.services.requirement_matcher import RequirementMatcher
from app.services.score_calculator import ScoreCalculator
from app.services.semantic_matcher import SemanticMatcher


class MatchingService:
    def match(
        self, payload: MatchingRequest, semantic_matcher: SemanticMatcher
    ) -> MatchingResponse:
        normalized = normalize_request(payload)
        must_have, should_have = RequirementMatcher().match(normalized)
        unresolved = [item for item in must_have + should_have if item.requires_manual_review]
        if unresolved and hasattr(semantic_matcher, "retrieve_evidence"):
            suggestions = semantic_matcher.retrieve_evidence(
                [item.requirement for item in unresolved], payload.candidate.cv_text
            )
            for item, evidence in zip(unresolved, suggestions):
                item.suggested_evidence = evidence
                if hasattr(semantic_matcher, "best_supported_evidence"):
                    _apply_semantic_partial_credit(item, semantic_matcher.best_supported_evidence(evidence))
        semantic_score = semantic_matcher.calculate_similarity(normalized)
        score = ScoreCalculator().calculate(must_have, should_have, semantic_score)
        settings = get_settings()
        highlights, missing, reasons = ExplanationService().generate(
            must_have, should_have, semantic_score, settings.semantic_match_threshold
        )
        if unresolved:
            reasons.append(
                f"{len(unresolved)} requirements need evidence review; inferred criteria are experimental "
                "and semantic suggestions are unverified, not proof of qualification."
            )
        failed_knockouts = [item.requirement for item in must_have if item.knockout and item.match_status != "MATCHED"]
        if failed_knockouts:
            reasons.append(
                f"Knockout requirement not fully met ({'; '.join(failed_knockouts)}); "
                f"score capped at {settings.knockout_score_cap:g}."
            )
        return MatchingResponse(
            requestId=normalized.request_id,
            applicationId=normalized.application_id,
            attemptNo=normalized.attempt_no,
            matchScore=score,
            semanticScore=semantic_score,
            mustHaveResult=must_have,
            shouldHaveResult=should_have,
            candidateHighlights=highlights,
            missingRequirements=missing,
            matchingReasons=reasons,
            requiresManualReview=bool(unresolved) or bool(failed_knockouts) or normalized.candidate.requires_manual_review,
            modelName=settings.embedding_model,
        )


def _apply_semantic_partial_credit(item: RequirementMatch, best: tuple[dict | None, float]) -> None:
    """Give bounded credit when the CV says the same thing in other words.

    Never turns a requirement into MATCHED and always keeps it for human
    review, so semantic evidence cannot replace a reviewer's verdict.
    """
    settings = get_settings()
    span, score = best
    threshold = (
        settings.reranker_credit_threshold
        if span is not None and "rerankScore" in span
        else settings.evidence_credit_threshold
    )
    credit = settings.evidence_partial_credit
    if (
        span is None
        or credit <= 0
        or score < threshold
        or item.match_status not in ("NOT_FOUND", "PARTIAL")
        or item.evidence_coverage >= credit
    ):
        return
    item.evidence_coverage = credit
    item.similarity = max(item.similarity, credit)
    item.match_status = "PARTIAL"
    item.match_method = "SEMANTIC_PARTIAL"
    item.requires_manual_review = True
    item.warnings = [*item.warnings, "SEMANTIC_PARTIAL_CREDIT"]
    if not item.evidence:
        item.evidence = span["text"]
