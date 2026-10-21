"""Posting the AI result retries transient failures only (test 21/10)."""

import httpx
import pytest

from app.config import Settings
from app.hrconnect_client import HRConnectClient


def client_with(responses: list, monkeypatch) -> tuple[HRConnectClient, list[int]]:
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        item = responses[min(len(calls), len(responses)) - 1]
        if isinstance(item, Exception):
            raise item
        return httpx.Response(item, request=request)

    settings = Settings(hrconnect_base_url="http://backend", callback_retry_attempts=4, callback_retry_base_seconds=0)
    client = HRConnectClient(settings)
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(client, "_service_client",
                        lambda: httpx.AsyncClient(base_url="http://backend", transport=transport))
    return client, calls


@pytest.mark.anyio
async def test_retries_network_errors_and_5xx_then_succeeds(monkeypatch):
    client, calls = client_with([httpx.ConnectError("down"), 502, 503, 200], monkeypatch)
    await client.post_ai_result({"requestId": "r"})
    assert len(calls) == 4


@pytest.mark.anyio
async def test_gives_up_after_the_configured_attempts(monkeypatch):
    client, calls = client_with([503], monkeypatch)
    with pytest.raises(httpx.HTTPStatusError):
        await client.post_ai_result({"requestId": "r"})
    assert len(calls) == 4


@pytest.mark.anyio
async def test_does_not_retry_a_real_rejection(monkeypatch):
    client, calls = client_with([400], monkeypatch)
    with pytest.raises(httpx.HTTPStatusError):
        await client.post_ai_result({"requestId": "r"})
    assert len(calls) == 1


@pytest.fixture
def anyio_backend():
    return "asyncio"
