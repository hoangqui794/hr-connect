from functools import lru_cache

import secrets

from fastapi import Header, HTTPException, status

from app.core.config import get_settings
from app.services.document_parser import DocumentParser
from app.services.ocr_service import get_ocr_engine
from app.services.semantic_matcher import SemanticMatcher


@lru_cache(maxsize=1)
def get_document_parser() -> DocumentParser:
    return DocumentParser(get_settings(), get_ocr_engine())


@lru_cache(maxsize=1)
def get_semantic_matcher() -> SemanticMatcher:
    return SemanticMatcher()


def require_test_endpoint_access(
    x_service_token: str | None = Header(default=None, alias="X-Service-Token"),
) -> None:
    """Protect standalone CV/matching endpoints outside explicitly local use."""
    settings = get_settings()
    if settings.allow_unauthenticated_test_endpoints:
        return
    expected = settings.hrconnect_service_token
    if not expected or not x_service_token or not secrets.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
