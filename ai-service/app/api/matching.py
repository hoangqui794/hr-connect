import logging
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.matching_request import MatchingRequest
from app.schemas.matching_response import MatchingResponse
from app.services.matching_service import MatchingService
from app.services.semantic_matcher import SemanticMatcher

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["matching"])


@lru_cache(maxsize=1)
def get_semantic_matcher() -> SemanticMatcher:
    return SemanticMatcher()


@router.post("/match", response_model=MatchingResponse, response_model_by_alias=True)
def match_candidate(
    payload: MatchingRequest,
    semantic_matcher: SemanticMatcher = Depends(get_semantic_matcher),
) -> MatchingResponse:
    try:
        return MatchingService().match(payload, semantic_matcher)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("AI matching failed for requestId=%s", payload.request_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI matching unavailable; candidate remains available for manual review",
        ) from exc
