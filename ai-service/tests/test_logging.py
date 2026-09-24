import json
import logging
import sys

from app.core.logging_config import JsonLogFormatter


def test_json_formatter_keeps_trace_context_and_omits_sensitive_extras() -> None:
    record = logging.LogRecord(
        name="app.services.scoring_worker",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="MF-03 scoring completed",
        args=(),
        exc_info=None,
    )
    record.event = "ai.scoring.completed"
    record.requestId = "request-001"
    record.applicationId = "application-001"
    record.durationMs = 1200
    record.serviceToken = "do-not-log"
    record.downloadUrl = "https://signed.example/cv.pdf"
    record.rawCvText = "private CV content"

    payload = json.loads(JsonLogFormatter().format(record))

    assert payload["event"] == "ai.scoring.completed"
    assert payload["requestId"] == "request-001"
    assert payload["applicationId"] == "application-001"
    assert payload["durationMs"] == 1200
    rendered = json.dumps(payload)
    assert "do-not-log" not in rendered
    assert "signed.example" not in rendered
    assert "private CV content" not in rendered


def test_json_formatter_does_not_render_sensitive_exception_message() -> None:
    try:
        raise RuntimeError("download failed: https://storage.example/cv.pdf?signature=secret")
    except RuntimeError:
        exc_info = sys.exc_info()

    record = logging.LogRecord(
        name="app.services.scoring_worker",
        level=logging.ERROR,
        pathname=__file__,
        lineno=40,
        msg="MF-03 scoring failed",
        args=(),
        exc_info=exc_info,
    )
    payload = json.loads(JsonLogFormatter().format(record))

    assert payload["exceptionType"] == "RuntimeError"
    rendered = json.dumps(payload)
    assert "storage.example" not in rendered
    assert "signature=secret" not in rendered
