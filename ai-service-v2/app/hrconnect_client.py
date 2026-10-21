"""HTTP boundary to the HR Connect backend internal APIs (same endpoints v1 uses)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.config import Settings
from app.schemas import Job

logger = logging.getLogger(__name__)


class HRConnectClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._timeout = httpx.Timeout(settings.internal_request_timeout_seconds)

    def _service_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._settings.hrconnect_base_url,
            headers={"X-Service-Token": self._settings.hrconnect_service_token},
            timeout=self._timeout,
            verify=self._settings.hrconnect_verify_ssl,
        )

    async def get_cv_metadata(self, cv_id: str) -> dict[str, Any]:
        async with self._service_client() as client:
            response = await client.get(f"/api/v1/internal/cvs/{cv_id}/download-url")
            response.raise_for_status()
            payload = response.json()
        metadata = payload.get("data")
        if not isinstance(metadata, dict) or not metadata.get("downloadUrl"):
            raise ValueError("HR Connect CV response is missing data.downloadUrl")
        return metadata

    async def get_job(self, job_id: str) -> Job:
        async with self._service_client() as client:
            response = await client.get(f"/api/v1/internal/jobs/{job_id}/jd")
            response.raise_for_status()
            return Job.model_validate(response.json())

    async def download_cv(self, download_url: str) -> bytes:
        # Never forward the service token to presigned storage URLs.
        max_bytes = self._settings.max_upload_size_mb * 1024 * 1024
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            async with client.stream("GET", download_url) as response:
                response.raise_for_status()
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > max_bytes:
                    raise ValueError("CV download exceeds the configured size limit")
                chunks: list[bytes] = []
                downloaded = 0
                async for chunk in response.aiter_bytes():
                    downloaded += len(chunk)
                    if downloaded > max_bytes:
                        raise ValueError("CV download exceeds the configured size limit")
                    chunks.append(chunk)
                return b"".join(chunks)

    async def post_ai_result(self, payload: dict[str, Any]) -> None:
        """Delivers the result; retries transient failures so a backend restart does not drop a finished score."""
        attempts = max(1, self._settings.callback_retry_attempts)
        for attempt in range(1, attempts + 1):
            try:
                async with self._service_client() as client:
                    response = await client.post("/api/v1/internal/ai-results", json=payload)
                    response.raise_for_status()
                return
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                if not _is_transient(exc) or attempt == attempts:
                    raise
                wait = self._settings.callback_retry_base_seconds * 2 ** (attempt - 1)
                logger.warning("Posting AI result failed (attempt %s/%s, %s); retrying in %.0fs",
                               attempt, attempts, _describe(exc), wait)
                await asyncio.sleep(wait)


def _is_transient(exc: httpx.HTTPError) -> bool:
    if isinstance(exc, httpx.TransportError):
        return True
    status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else 0
    return status == 429 or status >= 500


def _describe(exc: httpx.HTTPError) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code}"
    return type(exc).__name__
