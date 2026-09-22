import asyncio
import secrets

from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import get_settings
from app.schemas.scoring_job import ScoringJobAccepted, ScoringJobRequest
from app.services.scoring_worker import scoring_job_queue

router = APIRouter(prefix="/api/v1", tags=["scoring-jobs"])


@router.post(
    "/scoring-jobs",
    response_model=ScoringJobAccepted,
    response_model_by_alias=True,
    status_code=status.HTTP_202_ACCEPTED,
)
async def enqueue_scoring_job(
    payload: ScoringJobRequest,
    x_service_token: str | None = Header(default=None, alias="X-Service-Token"),
) -> ScoringJobAccepted:
    expected = get_settings().hrconnect_service_token
    if not expected or not x_service_token or not secrets.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    try:
        await scoring_job_queue.enqueue(payload)
    except asyncio.QueueFull as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scoring queue is full; retry later",
        ) from exc
    return ScoringJobAccepted(requestId=payload.request_id)
