"""Async scoring jobs from the HR Connect backend (same contract as v1 /api/v1/scoring-jobs).

Backend POSTs a job -> queued -> worker downloads CV + JD over internal APIs -> pipeline ->
result POSTed back to /api/v1/internal/ai-results (COMPLETED or FAILED).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import secrets
import time
from contextlib import suppress
from pathlib import Path
from typing import Any, Callable, Literal

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from app.config import Settings, get_settings
from app.documents import UnsupportedDocumentError, prepare_document
from app.hrconnect_client import HRConnectClient
from app.llm import LlmError
from app.pipeline import MatchingPipeline
from app.schemas import Job, MatchingMetadata, MatchingResult, MatchStatus, RequirementResult

logger = logging.getLogger(__name__)


class ScoringJobRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    request_id: str = Field(alias="requestId", min_length=1, max_length=200)
    application_id: str = Field(alias="applicationId", min_length=1, max_length=200)
    cv_id: str = Field(alias="cvId", min_length=1, max_length=200)
    job_id: str = Field(alias="jobId", min_length=1, max_length=200)
    attempt_no: int = Field(alias="attemptNo", ge=1)


class ScoringJobAccepted(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    request_id: str = Field(alias="requestId")
    status: Literal["ACCEPTED"] = "ACCEPTED"


def build_completed_payload(job: ScoringJobRequest, result: MatchingResult, cv_bytes: bytes,
                            job_data: Job, has_text_layer: bool) -> dict[str, Any]:
    """Map the v2 result onto the fields the backend and the HR screen read."""
    highlights, missing, reasons = build_explanations(result)
    return {
        "requestId": job.request_id,
        "applicationId": job.application_id,
        "cvId": job.cv_id,
        "jobId": job.job_id,
        "attemptNo": job.attempt_no,
        "status": "COMPLETED",
        "score": result.match_score,
        "candidateHighlights": highlights,
        "mustHaveResult": [_requirement_payload(item) for item in result.must_have_result],
        "shouldHaveResult": [_requirement_payload(item) for item in result.should_have_result],
        # v2 does not build a structured CV; leaving it out keeps the backend's existing parsed data.
        "structuredCvData": None,
        "parseConfidence": 1.0 if has_text_layer else 0.5,
        "requiresManualReview": result.requires_manual_review,
        "warnings": result.review_reasons,
        "diagnostics": [],
        "semanticScore": result.semantic_score,
        "missingRequirements": missing,
        "matchingReasons": reasons,
        "inputFingerprints": {
            "cvSha256": hashlib.sha256(cv_bytes).hexdigest(),
            "jdSha256": _job_fingerprint(job_data),
        },
        "modelVersion": result.model_name,
        "errorCode": None,
        "errorMessage": None,
    }


def build_explanations(result: MatchingResult) -> tuple[list[str], list[str], list[str]]:
    """Candidate highlights, missing requirements and reasons, in the order the HR screen shows them.

    Every highlight about a requirement carries a verified CV quote, so HR can check it without trusting the AI.
    """
    must, should = result.must_have_result, result.should_have_result
    ordered = [*must, *should]  # MUST_HAVE first: the screen shows only the first few highlights
    fit = result.overall_fit

    highlights: list[str] = []
    if result.candidate_summary:
        highlights.append(result.candidate_summary)
    highlights.append(f"Mức phù hợp tổng thể: {fit.level}/5 - {fit.reason}")
    for item in ordered:
        if item.match_status == MatchStatus.MATCHED:
            highlights.append(f"Đạt{_years_note(item)} - {item.requirement.content}{_quote(item)}")
    for item in ordered:
        if item.match_status == MatchStatus.PARTIAL:
            highlights.append(f"Đạt một phần - {item.requirement.content}{_quote(item)}")

    missing = [f"{item.requirement.content}: {_years_gap(item) or 'không tìm thấy trong CV'}" for item in ordered
               if item.match_status == MatchStatus.NOT_FOUND]
    missing += [f"{item.requirement.content}: {_years_gap(item) or 'chỉ đạt một phần - ' + item.reason}"
                for item in ordered if item.match_status == MatchStatus.PARTIAL and (item.reason or _years_gap(item))]
    missing += [f"{item.requirement.content}: AI chưa xác định được, cần HR xem" for item in ordered
                if item.match_status == MatchStatus.UNKNOWN]

    def counts(items: list[RequirementResult]) -> str:
        matched = sum(item.match_status == MatchStatus.MATCHED for item in items)
        partial = sum(item.match_status == MatchStatus.PARTIAL for item in items)
        return f"đạt {matched}/{len(items)}, một phần {partial}"

    reasons = [
        f"Yêu cầu bắt buộc: {counts(must)}",
        f"Yêu cầu ưu tiên: {counts(should)}",
        f"Độ giống nghĩa CV-JD (Sentence-BERT): {result.semantic_score:.2f}",
    ]
    reasons += [f"{item.requirement.content}: {item.reason}" for item in ordered
                if item.match_status == MatchStatus.MATCHED and item.reason]
    return highlights, missing, reasons


def _years_gap(item: RequirementResult) -> str:
    """'cần 3 năm, CV thể hiện khoảng 2 năm' for experience requirements whose years fall short."""
    needed = item.requirement.min_years
    if needed is None:
        return ""
    found = item.relevant_years
    if found is None or found <= 0:
        return f"cần {needed:g} năm, CV không thể hiện kinh nghiệm liên quan"
    if found < needed:
        return f"cần {needed:g} năm, CV thể hiện khoảng {found:g} năm"
    return ""


def _years_note(item: RequirementResult) -> str:
    """Always show the counted years on experience requirements, so HR can check the AI's count."""
    needed, found = item.requirement.min_years, item.relevant_years
    if needed is None or found is None:
        return ""
    near = "gần đủ: " if item.match_method == "LLM_YEARS_WITHIN_TOLERANCE" else ""
    return f" ({near}{found:g}/{needed:g} năm)"


def _quote(item: RequirementResult) -> str:
    return f': "{item.evidence[0]}"' if item.evidence else ""


def build_failed_payload(job: ScoringJobRequest, code: str, message: str) -> dict[str, Any]:
    return {
        "requestId": job.request_id,
        "applicationId": job.application_id,
        "cvId": job.cv_id,
        "jobId": job.job_id,
        "attemptNo": job.attempt_no,
        "status": "FAILED",
        "errorCode": code,
        "errorMessage": message,
    }


def _requirement_payload(item: RequirementResult) -> dict[str, Any]:
    # Keeps the v1 keys (requirement as text, matched, evidence as text) and adds the v2 detail.
    return {
        "requirement": item.requirement.content,
        "requirementId": item.requirement.id,
        "type": item.type.value,
        "matched": item.match_status == MatchStatus.MATCHED,
        "matchStatus": item.match_status.value,
        "evidence": " | ".join(item.evidence) or None,
        "evidenceQuotes": item.evidence,
        "unverifiedEvidence": item.unverified_evidence,
        "reason": item.reason,
        "relevantYears": item.relevant_years,
        "matchMethod": item.match_method,
        "requiresManualReview": item.requires_manual_review,
    }


def _job_fingerprint(job_data: Job) -> str:
    canonical = json.dumps(job_data.model_dump(mode="json", by_alias=True), ensure_ascii=False,
                           separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


class ScoringOrchestrator:
    def __init__(self, settings: Settings, client: HRConnectClient,
                 pipeline_factory: Callable[[], MatchingPipeline]) -> None:
        self._settings = settings
        self._client = client
        self._pipeline_factory = pipeline_factory

    async def process(self, job: ScoringJobRequest) -> None:
        """Scores one job within SCORING_JOB_TIMEOUT_SECONDS; past it the backend gets FAILED / AI_TIMEOUT."""
        started = time.monotonic()
        try:
            await asyncio.wait_for(self._process(job, started), timeout=self._settings.scoring_job_timeout_seconds)
        except asyncio.TimeoutError:
            # The LLM thread cannot be killed, but the application must not wait for it: manual review instead.
            logger.error("v2 scoring timed out request=%s application=%s after %.0fs",
                         job.request_id, job.application_id, time.monotonic() - started)
            await self._client.post_ai_result(build_failed_payload(
                job, "AI_TIMEOUT",
                f"AI chấm quá {self._settings.scoring_job_timeout_seconds:.0f} giây. Hồ sơ cần HR xem thủ công."))

    async def _process(self, job: ScoringJobRequest, started: float) -> None:
        logger.info("v2 scoring started request=%s application=%s attempt=%s",
                    job.request_id, job.application_id, job.attempt_no)
        cv_metadata, job_data = await asyncio.gather(
            self._client.get_cv_metadata(job.cv_id), self._client.get_job(job.job_id))
        data = await self._client.download_cv(cv_metadata["downloadUrl"])
        logger.info("v2 scoring fetched JD (%s requirements) and CV (%s bytes) request=%s",
                    len(job_data.requirements), len(data), job.request_id)
        try:
            document = prepare_document(cv_metadata.get("fileName") or "candidate.pdf", data)
        except UnsupportedDocumentError as exc:
            logger.warning("v2 scoring unsupported CV request=%s: %s", job.request_id, exc)
            await self._client.post_ai_result(build_failed_payload(job, "UNSUPPORTED_CV_FORMAT", str(exc)))
            return

        logger.info("v2 scoring document kind=%s text_layer=%s pages=%s request=%s",
                    document.kind, document.has_text_layer, document.page_count, job.request_id)
        metadata = MatchingMetadata(requestId=job.request_id, applicationId=job.application_id,
                                    attemptNo=job.attempt_no, job=job_data)
        try:
            result = await run_in_threadpool(self._pipeline_factory().run, metadata, document)
        except LlmError as exc:
            # AI unavailable: the backend routes the application to manual review, never to rejection.
            logger.warning("v2 scoring AI unavailable request=%s: %s", job.request_id, exc)
            await self._client.post_ai_result(build_failed_payload(job, "AI_PROVIDER_UNAVAILABLE", str(exc)))
            return

        await self._client.post_ai_result(
            build_completed_payload(job, result, data, job_data, document.has_text_layer))
        logger.info("v2 scoring completed request=%s application=%s score=%s in %.1fs",
                    job.request_id, job.application_id, result.match_score, time.monotonic() - started)

    async def callback_failed(self, job: ScoringJobRequest, code: str, message: str) -> None:
        try:
            await self._client.post_ai_result(build_failed_payload(job, code, message))
        except Exception:
            logger.exception("Failed to report scoring failure request=%s", job.request_id)


class ScoringJobQueue:
    """Bounded in-process queue; duplicate requestIds already queued are ignored.

    Accepted but unfinished jobs are mirrored to `scoring_queue_file` and re-queued on start, so a restart of
    the service (laptop sleep, redeploy) does not silently drop them (test 21/10).
    """

    def __init__(self) -> None:
        self._queue: asyncio.Queue[ScoringJobRequest] | None = None
        self._known: set[str] = set()
        self._pending: dict[str, ScoringJobRequest] = {}
        self._file: Path | None = None
        self._tasks: list[asyncio.Task[None]] = []
        self._orchestrator: ScoringOrchestrator | None = None

    @property
    def running(self) -> bool:
        return self._queue is not None

    async def start(self, settings: Settings, orchestrator: ScoringOrchestrator) -> None:
        if self._tasks:
            return
        self._orchestrator = orchestrator
        self._queue = asyncio.Queue(maxsize=settings.scoring_queue_size)
        self._known.clear()
        self._pending.clear()
        self._file = Path(settings.scoring_queue_file) if settings.scoring_queue_file else None
        restored = 0
        for job in self._load():
            if job.request_id in self._known or self._queue.full():
                continue
            self._known.add(job.request_id)
            self._pending[job.request_id] = job
            self._queue.put_nowait(job)
            restored += 1
        if restored:
            logger.info("v2 scoring re-queued %s unfinished job(s) from %s", restored, self._file)
        self._save()
        for index in range(settings.scoring_worker_count):
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
        self._pending.clear()

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
        self._pending[job.request_id] = job
        self._save()
        return True

    async def _worker(self, worker_id: int) -> None:
        queue = self._queue
        assert queue is not None and self._orchestrator is not None
        while True:
            job = await queue.get()
            try:
                await self._orchestrator.process(job)
            except asyncio.CancelledError:
                # Shutdown mid-job: keep it in the file so the next start scores it again.
                queue.task_done()
                raise
            except Exception:
                logger.exception("v2 scoring worker %s failed request=%s", worker_id, job.request_id)
                await self._orchestrator.callback_failed(job, "AI_SCORING_FAILED", "AI scoring failed")
            self._known.discard(job.request_id)
            self._pending.pop(job.request_id, None)
            self._save()
            queue.task_done()

    def _load(self) -> list[ScoringJobRequest]:
        if self._file is None or not self._file.exists():
            return []
        try:
            raw = json.loads(self._file.read_text(encoding="utf-8"))
            return [ScoringJobRequest.model_validate(item) for item in raw]
        except Exception:
            logger.exception("v2 scoring queue file %s is unreadable; starting empty", self._file)
            return []

    def _save(self) -> None:
        if self._file is None:
            return
        try:
            self._file.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._file.with_suffix(self._file.suffix + ".tmp")
            data = [job.model_dump(by_alias=True) for job in self._pending.values()]
            tmp.write_text(json.dumps(data), encoding="utf-8")
            os.replace(tmp, self._file)
        except OSError:
            logger.exception("v2 scoring queue could not be saved to %s", self._file)


scoring_job_queue = ScoringJobQueue()
router = APIRouter(prefix="/api/v1", tags=["scoring-jobs"])


@router.post("/scoring-jobs", response_model=ScoringJobAccepted, response_model_by_alias=True,
             status_code=status.HTTP_202_ACCEPTED)
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
        logger.warning("v2 scoring queue full request=%s", payload.request_id)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Scoring queue is full; retry later") from exc
    logger.info("v2 scoring queued request=%s application=%s", payload.request_id, payload.application_id)
    return ScoringJobAccepted(requestId=payload.request_id)
