"""Job suggestions for candidates (BE-04 C): semantic similarity only, no LLM, so it is cheap to run for many CVs.

Backend POSTs {jobId, cvIds}; the service reads the JD and each CV over the internal APIs and returns a 0..100
score per CV. A CV that cannot be read is reported with an error instead of failing the whole batch.
"""

from __future__ import annotations

import logging
import secrets
from typing import Any, Callable

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from app.config import Settings, get_settings
from app.documents import UnsupportedDocumentError, prepare_document

logger = logging.getLogger(__name__)


class SemanticMatchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    job_id: str = Field(alias="jobId", min_length=1, max_length=200)
    cv_ids: list[str] = Field(alias="cvIds", min_length=1, max_length=50)


class SemanticMatchItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    cv_id: str = Field(alias="cvId")
    score: float | None = None
    error: str | None = None


class SemanticMatchResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_id: str = Field(alias="jobId")
    results: list[SemanticMatchItem]


class JobMatcher:
    def __init__(self, client: Any, semantic_factory: Callable[[], Any]) -> None:
        self._client = client
        self._semantic_factory = semantic_factory

    async def match(self, request: SemanticMatchRequest) -> SemanticMatchResponse:
        job = await self._client.get_job(request.job_id)
        semantic = self._semantic_factory()
        results: list[SemanticMatchItem] = []
        for cv_id in dict.fromkeys(request.cv_ids):
            try:
                metadata = await self._client.get_cv_metadata(cv_id)
                data = await self._client.download_cv(metadata["downloadUrl"])
                document = prepare_document(metadata.get("fileName") or "cv.pdf", data)
                if not document.source_text.strip():
                    results.append(SemanticMatchItem(cvId=cv_id, error="CV_HAS_NO_TEXT"))
                    continue
                similarity = await run_in_threadpool(semantic.similarity, document.source_text, job)
                results.append(SemanticMatchItem(cvId=cv_id, score=round(similarity * 100, 2)))
            except UnsupportedDocumentError:
                results.append(SemanticMatchItem(cvId=cv_id, error="CV_UNSUPPORTED"))
            except Exception:  # one unreadable CV must not stop the batch
                logger.exception("semantic match failed job=%s cv=%s", request.job_id, cv_id)
                results.append(SemanticMatchItem(cvId=cv_id, error="CV_READ_FAILED"))
        return SemanticMatchResponse(jobId=request.job_id, results=results)


def get_job_matcher() -> JobMatcher:
    from app.hrconnect_client import HRConnectClient
    from app.semantic import SemanticMatcher

    settings = get_settings()
    return JobMatcher(HRConnectClient(settings), lambda: SemanticMatcher(settings))


router = APIRouter(prefix="/api/v1", tags=["job-match"])


@router.post("/semantic-match", response_model=SemanticMatchResponse, response_model_by_alias=True)
async def semantic_match(
    payload: SemanticMatchRequest,
    x_service_token: str | None = Header(default=None, alias="X-Service-Token"),
    settings: Settings = Depends(get_settings),
    matcher: JobMatcher = Depends(get_job_matcher),
) -> SemanticMatchResponse:
    expected = settings.hrconnect_service_token
    if not expected or not x_service_token or not secrets.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return await matcher.match(payload)
