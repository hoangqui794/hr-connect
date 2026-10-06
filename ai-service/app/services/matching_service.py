from app.core.config import get_settings
from app.schemas.matching_request import MatchingRequest
from app.schemas.matching_response import MatchingResponse
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
            requiresManualReview=bool(unresolved) or normalized.candidate.requires_manual_review,
            modelName=settings.embedding_model,
        )
