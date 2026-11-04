from io import BytesIO

import pytest
from fastapi import UploadFile

from app.uploads import UploadTooLargeError, read_upload_limited, request_may_exceed_file_limit


@pytest.mark.anyio
async def test_read_upload_limited_accepts_exact_limit():
    upload = UploadFile(filename="cv.pdf", file=BytesIO(b"abcdefgh"))

    result = await read_upload_limited(upload, max_bytes=8, chunk_size=3)

    assert result == b"abcdefgh"


@pytest.mark.anyio
async def test_read_upload_limited_stops_when_limit_is_exceeded():
    upload = UploadFile(filename="cv.pdf", file=BytesIO(b"a" * 100))

    with pytest.raises(UploadTooLargeError) as error:
        await read_upload_limited(upload, max_bytes=8, chunk_size=3)

    assert error.value.max_bytes == 8
    # Only the first chunk beyond the limit is read; the remaining 91 bytes are never buffered.
    assert upload.file.tell() == 9


@pytest.mark.parametrize(
    ("content_length", "expected"),
    [(None, False), ("invalid", False), ("20", False), ("21", True)],
)
def test_request_length_hint_allows_multipart_overhead(content_length, expected):
    assert request_may_exceed_file_limit(
        content_length,
        max_file_bytes=10,
        multipart_overhead_bytes=10,
    ) is expected
