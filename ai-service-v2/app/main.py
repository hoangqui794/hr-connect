from __future__ import annotations

import json
import logging
import secrets
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.documents import UnsupportedDocumentError, prepare_document
from app.hrconnect_client import HRConnectClient
from app.job_match import router as job_match_router
from app.llm import LlmError, make_assessor
from app.pipeline import MatchingPipeline
from app.schemas import FileMatchingResponse, MatchingMetadata, ParseResult
from app.scoring_jobs import ScoringOrchestrator, scoring_job_queue
from app.scoring_jobs import router as scoring_router
from app.semantic import SemanticMatcher

@lru_cache
def get_pipeline() -> MatchingPipeline:
    settings = get_settings()
    return MatchingPipeline(settings, make_assessor(settings), SemanticMatcher(settings))


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    orchestrator = ScoringOrchestrator(settings, HRConnectClient(settings), get_pipeline)
    await scoring_job_queue.start(settings, orchestrator)
    try:
        yield
    finally:
        await scoring_job_queue.stop()


_startup_settings = get_settings()
logging.basicConfig(level=_startup_settings.log_level.upper(),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# Library request logs (model downloads at startup, every HTTP call) drown the scoring steps at INFO.
for _noisy in ("httpx", "httpcore", "huggingface_hub", "urllib3", "sentence_transformers"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

# API docs: on with API_DOCS_ENABLED (endpoints keep their token checks), or in unauthenticated local testing.
_docs_enabled = _startup_settings.api_docs_enabled or _startup_settings.allow_unauthenticated_test_endpoints
app = FastAPI(title="HR Connect AI Service v2", version="2.0.0", lifespan=lifespan,
              docs_url="/docs" if _docs_enabled else None,
              redoc_url="/redoc" if _docs_enabled else None,
              openapi_url="/openapi.json" if _docs_enabled else None)
app.include_router(scoring_router)
app.include_router(job_match_router)


def require_test_access(
    settings: Settings = Depends(get_settings),
    x_service_token: str | None = Header(default=None, alias="X-Service-Token"),
) -> None:
    """match-file spends LLM quota: open only in local testing, otherwise the backend service token."""
    if settings.allow_unauthenticated_test_endpoints:
        return
    expected = settings.hrconnect_service_token
    if not expected or not x_service_token or not secrets.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ai-service-v2"}


@app.post("/api/v1/match-file", response_model=FileMatchingResponse, response_model_by_alias=True,
          dependencies=[Depends(require_test_access)])
async def match_file(
    file: Annotated[UploadFile, File(...)],
    metadata: Annotated[str, Form(...)],
    settings: Settings = Depends(get_settings),
    pipeline: MatchingPipeline = Depends(get_pipeline),
) -> FileMatchingResponse:
    """Same contract as v1 `/api/v1/match-file`: multipart CV file + matching metadata JSON."""
    try:
        parsed = MatchingMetadata.model_validate(json.loads(metadata))
    except (ValidationError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail="metadata must be valid matching JSON") from exc

    data = await file.read()
    await file.close()
    if len(data) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File larger than {settings.max_upload_size_mb} MB.")

    try:
        document = prepare_document(file.filename or "cv", data)
    except UnsupportedDocumentError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc

    try:
        result = await run_in_threadpool(pipeline.run, parsed, document)
    except LlmError as exc:
        # AI failure must route to manual review, never to rejection.
        raise HTTPException(status_code=503, detail=f"{exc} Hồ sơ cần HR xem thủ công.") from exc

    return FileMatchingResponse(
        parseResult=ParseResult(
            extractionMethod=document.extraction_method,
            hasTextLayer=document.has_text_layer,
            pageCount=document.page_count,
        ),
        matchingResult=result,
    )
