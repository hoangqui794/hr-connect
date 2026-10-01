from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.schemas.matching_request import Job


class HRConnectClient:
    """HTTP boundary between MF-03 and HR Connect internal APIs."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._timeout = httpx.Timeout(self._settings.internal_request_timeout_seconds)

    def _service_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._settings.hrconnect_base_url,
            headers={"X-Service-Token": self._settings.hrconnect_service_token},
            timeout=self._timeout,
            verify=self._settings.hrconnect_verify_ssl,
        )

    async def get_cv_metadata(self, cv_id: object) -> dict[str, Any]:
        async with self._service_client() as client:
            response = await client.get(f"/api/v1/internal/cvs/{cv_id}/download-url")
            response.raise_for_status()
            payload = response.json()
        metadata = payload.get("data")
        if not isinstance(metadata, dict) or not metadata.get("downloadUrl"):
            raise ValueError("HR Connect CV response is missing data.downloadUrl")
        return metadata

    async def get_job(self, job_id: object) -> Job:
        async with self._service_client() as client:
            response = await client.get(f"/api/v1/internal/jobs/{job_id}/jd")
            response.raise_for_status()
            return Job.model_validate(response.json())

    async def download_cv(self, download_url: str) -> bytes:
        # Never forward the HR Connect service token to presigned storage URLs.
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
        async with self._service_client() as client:
            response = await client.post("/api/v1/internal/ai-results", json=payload)
            response.raise_for_status()
