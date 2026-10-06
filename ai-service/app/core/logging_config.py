import json
import logging
from datetime import UTC, datetime


_CONTEXT_FIELDS = (
    "event",
    "requestId",
    "applicationId",
    "cvId",
    "jobId",
    "attemptNo",
    "workerId",
    "status",
    "durationMs",
    "modelVersion",
    "failureCode",
    "duplicate",
    "fileSizeBytes",
    "pageCount",
    "extractionMethod",
    "ocrApplied",
)


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in _CONTEXT_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info and record.exc_info[0] is not None:
            # Exception messages from HTTP clients can contain presigned URLs.
            # Keep the diagnostic type while avoiding credentials or CV URLs.
            payload["exceptionType"] = record.exc_info[0].__name__
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        handlers=[handler],
        force=True,
    )
