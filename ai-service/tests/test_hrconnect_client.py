import asyncio
from types import SimpleNamespace

from app.clients import hrconnect_client
from app.clients.hrconnect_client import HRConnectClient


class _Response:
    def __init__(self, *, payload=None, content: bytes = b"") -> None:
        self._payload = payload
        self.content = content
        self.raise_called = False
        self.headers = {}

    def raise_for_status(self) -> None:
        self.raise_called = True

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    def json(self):
        return self._payload

    async def aiter_bytes(self):
        yield self.content


class _Client:
    def __init__(self, response: _Response) -> None:
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def get(self, _url: str) -> _Response:
        return self._response

    def stream(self, _method: str, _url: str):
        return self._response


def _settings():
    return SimpleNamespace(
        hrconnect_base_url="https://localhost:7289",
        hrconnect_service_token="secret",
        hrconnect_verify_ssl=False,
        internal_request_timeout_seconds=30,
        max_upload_size_mb=10,
    )


def test_cv_metadata_uses_service_token_and_unwraps_data(monkeypatch) -> None:
    calls = []
    response = _Response(
        payload={"data": {"downloadUrl": "https://storage.example/cv", "fileName": "cv.pdf"}}
    )

    def create_client(**kwargs):
        calls.append(kwargs)
        return _Client(response)

    monkeypatch.setattr(hrconnect_client.httpx, "AsyncClient", create_client)

    metadata = asyncio.run(HRConnectClient(_settings()).get_cv_metadata("cv-1"))

    assert metadata["fileName"] == "cv.pdf"
    assert calls[0]["headers"] == {"X-Service-Token": "secret"}
    assert response.raise_called is True


def test_presigned_download_rejects_response_larger_than_limit(monkeypatch) -> None:
    response = _Response(content=b"pdf-bytes")
    response.headers = {"Content-Length": str(11 * 1024 * 1024)}

    monkeypatch.setattr(hrconnect_client.httpx, "AsyncClient", lambda **_: _Client(response))

    try:
        asyncio.run(HRConnectClient(_settings()).download_cv("https://storage.example/cv"))
    except ValueError as exc:
        assert "size limit" in str(exc)
    else:
        raise AssertionError("Expected oversized download to be rejected")


def test_presigned_download_does_not_forward_service_token(monkeypatch) -> None:
    calls = []
    response = _Response(content=b"pdf-bytes")

    def create_client(**kwargs):
        calls.append(kwargs)
        return _Client(response)

    monkeypatch.setattr(hrconnect_client.httpx, "AsyncClient", create_client)

    content = asyncio.run(
        HRConnectClient(_settings()).download_cv("https://storage.example/cv")
    )

    assert content == b"pdf-bytes"
    assert "headers" not in calls[0]
    assert response.raise_called is True
