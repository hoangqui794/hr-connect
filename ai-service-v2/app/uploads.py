from __future__ import annotations

from dataclasses import dataclass

from fastapi import UploadFile


DEFAULT_UPLOAD_CHUNK_SIZE = 128 * 1024


@dataclass(frozen=True, slots=True)
class UploadTooLargeError(Exception):
    max_bytes: int


def request_may_exceed_file_limit(
    content_length: str | None,
    *,
    max_file_bytes: int,
    multipart_overhead_bytes: int = 1024 * 1024,
) -> bool:
    """Fast rejection hint only; the streamed byte count remains authoritative."""
    if content_length is None:
        return False

    try:
        request_bytes = int(content_length)
    except (TypeError, ValueError):
        return False

    return request_bytes > max_file_bytes + multipart_overhead_bytes


async def read_upload_limited(
    upload: UploadFile,
    *,
    max_bytes: int,
    chunk_size: int = DEFAULT_UPLOAD_CHUNK_SIZE,
) -> bytes:
    """Read an upload in bounded chunks and stop before buffering past max_bytes."""
    if max_bytes < 1:
        raise ValueError("max_bytes must be positive")
    if chunk_size < 1:
        raise ValueError("chunk_size must be positive")

    data = bytearray()
    while True:
        chunk = await upload.read(chunk_size)
        if not chunk:
            return bytes(data)
        if len(data) + len(chunk) > max_bytes:
            raise UploadTooLargeError(max_bytes=max_bytes)
        data.extend(chunk)
