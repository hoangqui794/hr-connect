import asyncio
import logging
from contextlib import suppress

from app.core.config import get_settings
from app.schemas.scoring_job import ScoringJobRequest
from app.services.scoring_orchestrator import ScoringOrchestrator

logger = logging.getLogger(__name__)


class ScoringJobQueue:
    """Bounded in-process queue used by the standalone MF-03 service."""

    def __init__(self, orchestrator: ScoringOrchestrator | None = None) -> None:
        self._queue: asyncio.Queue[ScoringJobRequest] | None = None
        self._known: set[str] = set()
        self._tasks: list[asyncio.Task[None]] = []
        self._orchestrator = orchestrator or ScoringOrchestrator()

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
                await self._orchestrator.process(job)
            except Exception:
                logger.exception(
                    "MF-03 scoring worker failed",
                    extra={
                        "event": "ai.scoring.failed",
                        "requestId": job.request_id,
                        "applicationId": str(job.application_id),
                        "cvId": str(job.cv_id),
                        "jobId": str(job.job_id),
                        "attemptNo": job.attempt_no,
                        "workerId": worker_id,
                        "status": "FAILED",
                        "failureCode": "AI_SCORING_FAILED",
                    },
                )
                await self._orchestrator.callback_failed(job, "AI_SCORING_FAILED", "AI scoring failed")
            finally:
                self._known.discard(job.request_id)
                queue.task_done()


scoring_job_queue = ScoringJobQueue()
