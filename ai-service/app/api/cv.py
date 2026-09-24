import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.dependencies import get_document_parser, get_semantic_matcher
from app.schemas.cv import (
    CvParseResponse,
    DocumentMetadata,
    FileMatchingMetadata,
    FileMatchingResponse,
)
from app.schemas.matching_request import Candidate, CandidateSkill, MatchingRequest, RequirementCategory
from app.services.document_parser import CvProcessingError, DocumentParser
from app.services.matching_service import MatchingService
from app.services.semantic_matcher import SemanticMatcher
from app.services.structured_cv_parser import StructuredCvParser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["cv"])


async def _read_upload(file: UploadFile) -> bytes:
    limit = get_settings().max_upload_size_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise CvProcessingError(413, "Uploaded CV exceeds the configured size limit")
    return data


async def _parse_upload(
    file: UploadFile,
    parser: DocumentParser,
    job_skills: list[str] | None = None,
) -> CvParseResponse:
    try:
        data = await _read_upload(file)
        extracted = await run_in_threadpool(
            parser.parse,
            file.filename or "",
            file.content_type,
            data,
        )
        parsed = StructuredCvParser().parse_with_diagnostics(
            extracted.text, job_skills, extracted.blocks
        )
        return CvParseResponse(
            document=DocumentMetadata(
                fileName=file.filename or "cv",
                mediaType=extracted.media_type,
                fileSizeBytes=len(data),
                pageCount=extracted.page_count,
                extractionMethod=extracted.extraction_method,
                ocrApplied=extracted.ocr_applied,
                layout=extracted.layout,
            ),
            rawText=extracted.text,
            candidate=parsed.candidate,
            parseConfidence=parsed.confidence,
            requiresManualReview=parsed.requires_manual_review,
            warnings=list(dict.fromkeys([*extracted.warnings, *parsed.warnings])),
        )
    finally:
        await file.close()


def _raise_cv_error(exc: Exception) -> None:
    if isinstance(exc, CvProcessingError):
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    logger.exception("Standalone CV processing failed")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="CV processing unavailable; candidate remains available for manual review",
    ) from exc


@router.post("/cv/parse", response_model=CvParseResponse, response_model_by_alias=True)
async def parse_cv(
    file: Annotated[UploadFile, File(...)],
    parser: DocumentParser = Depends(get_document_parser),
) -> CvParseResponse:
    try:
        return await _parse_upload(file, parser)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_cv_error(exc)
        raise AssertionError("unreachable")


@router.post("/match-file", response_model=FileMatchingResponse, response_model_by_alias=True)
async def match_cv_file(
    file: Annotated[UploadFile, File(...)],
    metadata: Annotated[str, Form(...)],
    parser: DocumentParser = Depends(get_document_parser),
    semantic_matcher: SemanticMatcher = Depends(get_semantic_matcher),
) -> FileMatchingResponse:
    try:
        parsed_metadata = FileMatchingMetadata.model_validate_json(metadata)
    except (ValidationError, json.JSONDecodeError) as exc:
        await file.close()
        raise HTTPException(status_code=422, detail="metadata must be valid matching JSON") from exc

    try:
        job_skills = [
            requirement.content
            for requirement in parsed_metadata.job.requirements
            if requirement.category == RequirementCategory.SKILL
        ]
        parse_result = await _parse_upload(file, parser, job_skills)
        structured = parse_result.candidate
        summary = structured.summary or parse_result.raw_text[:5000]
        request = MatchingRequest(
            requestId=parsed_metadata.request_id,
            applicationId=parsed_metadata.application_id,
            attemptNo=parsed_metadata.attempt_no,
            candidate=Candidate(
                summary=summary,
                yearsOfExperience=structured.total_years_of_experience,
                highestEducation=(
                    structured.education[0].degree or structured.education[0].school
                    if structured.education
                    else None
                ),
                skills=[
                    CandidateSkill(name=skill.name, yearsOfExperience=skill.years_of_experience)
                    for skill in structured.skills
                ],
                cvText=parse_result.raw_text,
            ),
            job=parsed_metadata.job,
        )
        matching_result = await run_in_threadpool(
            MatchingService().match, request, semantic_matcher
        )
        return FileMatchingResponse(parseResult=parse_result, matchingResult=matching_result)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_cv_error(exc)
        raise AssertionError("unreachable")
