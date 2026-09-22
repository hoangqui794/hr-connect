import asyncio
import logging
from contextlib import suppress

import httpx
from starlette.concurrency import run_in_threadpool

from app.api.cv import get_document_parser
from app.api.matching import get_semantic_matcher
from app.core.config import get_settings
from app.schemas.cv import CvParseResponse, DocumentMetadata
from app.schemas.matching_request import Candidate, CandidateSkill, Job, MatchingRequest, RequirementCategory
from app.schemas.scoring_job import ScoringJobRequest
from app.services.matching_service import MatchingService
from app.services.structured_cv_parser import StructuredCvParser

logger = logging.getLogger(__name__)


class ScoringJobQueue:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[ScoringJobRequest] | None = None
        self._known: set[str] = set()
        self._tasks: list[asyncio.Task[None]] = []

    async def start(self) -> None:
        if self._tasks:
            return
        self._queue = asyncio.Queue(maxsize=get_settings().scoring_queue_size)
        self._known.clear()
        for index in range(get_settings().scoring_worker_count):
            self._tasks.append(asyncio.create_task(self._worker(index)))

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with suppress(asyncio.CancelledError):
                await task
        self._tasks.clear()
        self._queue = None
        self._known.clear()

    async def enqueue(self, job: ScoringJobRequest) -> bool:
        if self._queue is None:
            raise RuntimeError("Scoring job queue is not running")
        if job.request_id in self._known:
            return False
        self._known.add(job.request_id)
        try:
            self._queue.put_nowait(job)
        except asyncio.QueueFull:
            self._known.discard(job.request_id)
            raise
        return True

    async def _worker(self, worker_id: int) -> None:
        queue = self._queue
        if queue is None:
            raise RuntimeError("Scoring job queue is not running")
        while True:
            job = await queue.get()
            try:
                await self._process(job)
            except Exception:
                logger.exception("Scoring worker %s failed request %s", worker_id, job.request_id)
                await self._callback_failed(job, "AI_SCORING_FAILED")
            finally:
                self._known.discard(job.request_id)
                queue.task_done()

    async def _process(self, job: ScoringJobRequest) -> None:
        settings = get_settings()
        headers = {"X-Service-Token": settings.hrconnect_service_token}
        timeout = httpx.Timeout(settings.internal_request_timeout_seconds)
        async with httpx.AsyncClient(
            base_url=settings.hrconnect_base_url,
            headers=headers,
            timeout=timeout,
            verify=False,
        ) as client:
            cv_response, job_response = await asyncio.gather(
                client.get(f"/api/v1/internal/cvs/{job.cv_id}/download-url"),
                client.get(f"/api/v1/internal/jobs/{job.job_id}/jd"),
            )
            cv_response.raise_for_status()
            job_response.raise_for_status()
            cv_payload = cv_response.json()
            cv_metadata = cv_payload.get("data")
            if not isinstance(cv_metadata, dict) or not cv_metadata.get("downloadUrl"):
                raise ValueError("HR Connect CV response is missing data.downloadUrl")
            job_data = Job.model_validate(job_response.json())

            # The presigned storage request must not receive HR Connect's service token.
            async with httpx.AsyncClient(timeout=timeout) as download_client:
                file_response = await download_client.get(cv_metadata["downloadUrl"])
                file_response.raise_for_status()
                data = file_response.content

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
            )
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
                warnings=list(dict.fromkeys([*extracted.warnings, *parsed.warnings])),
            )

            structured = parse_result.candidate
            matching_request = MatchingRequest(
                requestId=job.request_id,
                applicationId=job.application_id,
                attemptNo=job.attempt_no,
                candidate=Candidate(
                    summary=structured.summary or parse_result.raw_text[:5000],
                    yearsOfExperience=structured.total_years_of_experience,
                    highestEducation=(
                        structured.education[0].degree or structured.education[0].school
                        if structured.education
                        else None
                    ),
                    skills=[
                        CandidateSkill(
                            name=skill.name,
                            yearsOfExperience=skill.years_of_experience,
                        )
                        for skill in structured.skills
                    ],
                    cvText=parse_result.raw_text,
                ),
                job=job_data,
            )
            match = await run_in_threadpool(
                MatchingService().match,
                matching_request,
                get_semantic_matcher(),
            )

            callback = {
                "requestId": job.request_id,
                "applicationId": job.application_id,
                "cvId": job.cv_id,
                "jobId": job.job_id,
                "attemptNo": job.attempt_no,
                "status": "COMPLETED",
                "score": match.match_score,
                "candidateHighlights": match.candidate_highlights,
                "mustHaveResult": [
                    item.model_dump(by_alias=True) for item in match.must_have_result
                ],
                "shouldHaveResult": [
                    item.model_dump(by_alias=True) for item in match.should_have_result
                ],
                "structuredCvData": structured.model_dump(by_alias=True),
                "modelVersion": match.model_name,
                "errorMessage": None,
            }
            response = await client.post("/api/v1/internal/ai-results", json=callback)
            response.raise_for_status()

    async def _callback_failed(self, job: ScoringJobRequest, message: str) -> None:
        settings = get_settings()
        try:
            async with httpx.AsyncClient(
                base_url=settings.hrconnect_base_url,
                headers={"X-Service-Token": settings.hrconnect_service_token},
                timeout=settings.internal_request_timeout_seconds,
                verify=False,
            ) as client:
                await client.post(
                    "/api/v1/internal/ai-results",
                    json={
                        "requestId": job.request_id,
                        "applicationId": job.application_id,
                        "cvId": job.cv_id,
                        "jobId": job.job_id,
                        "attemptNo": job.attempt_no,
                        "status": "FAILED",
                        "errorMessage": message,
                    },
                )
        except Exception:
            logger.exception("Failed to report scoring failure for %s", job.request_id)


scoring_job_queue = ScoringJobQueue()
