from __future__ import annotations

import json
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.documents import UnsupportedDocumentError, prepare_document
from app.llm import LlmError, make_assessor
from app.pipeline import MatchingPipeline
from app.schemas import FileMatchingResponse, MatchingMetadata, ParseResult
from app.semantic import SemanticMatcher

app = FastAPI(title="HR Connect AI Service v2", version="2.0.0")


@lru_cache
def get_pipeline() -> MatchingPipeline:
    settings = get_settings()
    return MatchingPipeline(settings, make_assessor(settings), SemanticMatcher(settings))


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ai-service-v2"}


@app.post("/api/v1/match-file", response_model=FileMatchingResponse, response_model_by_alias=True)
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
