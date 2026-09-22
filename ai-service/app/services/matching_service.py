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
        semantic_score = semantic_matcher.calculate_similarity(normalized)
        score = ScoreCalculator().calculate(must_have, should_have, semantic_score)
        settings = get_settings()
        highlights, missing, reasons = ExplanationService().generate(
            must_have, should_have, semantic_score, settings.semantic_match_threshold
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
            modelName=settings.embedding_model,
        )
