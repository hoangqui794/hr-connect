from functools import lru_cache

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
