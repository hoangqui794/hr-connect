import asyncio
import hashlib
import json
import logging
import time

from starlette.concurrency import run_in_threadpool

from app.clients.hrconnect_client import HRConnectClient
from app.core.dependencies import get_document_parser, get_semantic_matcher
from app.schemas.cv import CvParseResponse, DocumentMetadata
from app.schemas.matching_request import MatchingRequest, RequirementCategory
from app.schemas.scoring_job import ScoringJobRequest
from app.services.candidate_builder import candidate_from_parse
from app.services.matching_service import MatchingService
from app.services.parse_diagnostics import build_parse_diagnostics
from app.services.structured_cv_parser import StructuredCvParser

logger = logging.getLogger(__name__)


class ScoringOrchestrator:
    """Runs one MF-03 scoring job from internal data fetch through callback."""

    def __init__(self, client: HRConnectClient | None = None) -> None:
        self._client = client or HRConnectClient()

    async def process(self, job: ScoringJobRequest) -> None:
        started_at = time.monotonic()
        context = _log_context(job)
        logger.info(
            "MF-03 scoring started",
            extra={"event": "ai.scoring.started", "status": "PROCESSING", **context},
        )

        cv_metadata, job_data = await asyncio.gather(
            self._client.get_cv_metadata(job.cv_id),
            self._client.get_job(job.job_id),
        )
        data = await self._client.download_cv(cv_metadata["downloadUrl"])
        logger.info(
            "CV downloaded for MF-03 scoring",
            extra={"event": "ai.cv.downloaded", "fileSizeBytes": len(data), **context},
        )

        extracted = await run_in_threadpool(
            get_document_parser().parse,
            cv_metadata.get("fileName") or "candidate.pdf",
            cv_metadata.get("mimeType"),
            data,
        )
        job_skills = [
            item.content
            for item in job_data.requirements
            if item.category == RequirementCategory.SKILL
        ]
        parsed = await run_in_threadpool(
            StructuredCvParser().parse_with_diagnostics,
            extracted.text,
            job_skills,
            extracted.blocks,
            layout=extracted.layout,
            ocr_applied=extracted.ocr_applied,
        )
        warnings = list(dict.fromkeys([*extracted.warnings, *parsed.warnings]))
        parse_result = CvParseResponse(
            document=DocumentMetadata(
                fileName=cv_metadata.get("fileName") or "candidate.pdf",
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
            warnings=warnings,
            diagnostics=build_parse_diagnostics(extracted, warnings),
        )
        logger.info(
            "CV parsed for MF-03 scoring",
            extra={
                "event": "ai.cv.parsed",
                "pageCount": extracted.page_count,
                "extractionMethod": extracted.extraction_method,
                "ocrApplied": extracted.ocr_applied,
                **context,
            },
        )

        matching_request = _to_matching_request(job, job_data, parse_result)
        match = await run_in_threadpool(
            MatchingService().match,
            matching_request,
            get_semantic_matcher(),
        )
        await self._client.post_ai_result(
            {
                "requestId": job.request_id,
                "applicationId": job.application_id,
                "cvId": job.cv_id,
                "jobId": job.job_id,
                "attemptNo": job.attempt_no,
                "status": "COMPLETED",
                "score": match.match_score,
                "candidateHighlights": match.candidate_highlights,
                "mustHaveResult": [item.model_dump(by_alias=True) for item in match.must_have_result],
                "shouldHaveResult": [item.model_dump(by_alias=True) for item in match.should_have_result],
                "structuredCvData": parse_result.candidate.model_dump(by_alias=True),
                "parseConfidence": parse_result.parse_confidence,
                "requiresManualReview": (
                    parse_result.requires_manual_review or match.requires_manual_review
                ),
                "warnings": parse_result.warnings,
                "diagnostics": [
                    item.model_dump(by_alias=True) for item in parse_result.diagnostics
                ],
                "semanticScore": match.semantic_score,
                "missingRequirements": match.missing_requirements,
                "matchingReasons": match.matching_reasons,
                "inputFingerprints": {
                    "cvSha256": hashlib.sha256(data).hexdigest(),
                    "jdSha256": _job_fingerprint(job_data),
                },
                "modelVersion": match.model_name,
                "errorCode": None,
                "errorMessage": None,
            }
        )
        logger.info(
            "MF-03 scoring completed and callback acknowledged",
            extra={
                "event": "ai.scoring.completed",
                "status": "COMPLETED",
                "durationMs": round((time.monotonic() - started_at) * 1000),
                "modelVersion": match.model_name,
                **context,
            },
        )

    async def callback_failed(self, job: ScoringJobRequest, failure_code: str, message: str) -> None:
        try:
            await self._client.post_ai_result(
                {
                    "requestId": job.request_id,
                    "applicationId": job.application_id,
                    "cvId": job.cv_id,
                    "jobId": job.job_id,
                    "attemptNo": job.attempt_no,
                    "status": "FAILED",
                    "errorCode": failure_code,
                    "errorMessage": message,
                }
            )
        except Exception:
            logger.exception(
                "Failed to report MF-03 scoring failure",
                extra={
                    "event": "ai.callback.failed",
                    "status": "FAILED",
                    "failureCode": failure_code,
                    **_log_context(job),
                },
            )


def _to_matching_request(job, job_data, parse_result: CvParseResponse) -> MatchingRequest:
    return MatchingRequest(
        requestId=job.request_id,
        applicationId=job.application_id,
        attemptNo=job.attempt_no,
        candidate=candidate_from_parse(parse_result),
        job=job_data,
    )


def _log_context(job: ScoringJobRequest) -> dict[str, object]:
    return {
        "requestId": job.request_id,
        "applicationId": str(job.application_id),
        "cvId": str(job.cv_id),
        "jobId": str(job.job_id),
        "attemptNo": job.attempt_no,
    }


def _job_fingerprint(job_data) -> str:
    canonical = json.dumps(
        job_data.model_dump(mode="json", by_alias=True),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()
