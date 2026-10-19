from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.documents import PreparedDocument, UnsupportedDocumentError
from app.job_match import JobMatcher, get_job_matcher
from tests.test_pipeline import FakeSemantic
from tests.test_scoring_jobs import FakeClient


def _doc(text):
    return PreparedDocument(kind="pdf", media_type="application/pdf", data=b"", source_text=text,
                            extraction_method="PDF_TEXT_AND_VISION", has_text_layer=bool(text), page_count=1)


def _client(monkeypatch, documents):
    def prepare(name, data):
        result = documents.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr("app.job_match.prepare_document", prepare)
    from app.main import app

    app.dependency_overrides[get_settings] = lambda: Settings(hrconnect_service_token="secret")
    app.dependency_overrides[get_job_matcher] = lambda: JobMatcher(FakeClient(), lambda: FakeSemantic(0.734))
    return TestClient(app)


def test_semantic_match_scores_each_cv_and_reports_bad_ones(monkeypatch):
    client = _client(monkeypatch, [_doc("C# ASP.NET Core"), _doc(""), UnsupportedDocumentError("x")])
    try:
        response = client.post("/api/v1/semantic-match", headers={"X-Service-Token": "secret"},
                               json={"jobId": "j1", "cvIds": ["a", "b", "c", "a"]})
    finally:
        client.app.dependency_overrides.clear()

    assert response.status_code == 200
    results = response.json()["results"]
    assert results == [
        {"cvId": "a", "score": 73.4, "error": None},
        {"cvId": "b", "score": None, "error": "CV_HAS_NO_TEXT"},
        {"cvId": "c", "score": None, "error": "CV_UNSUPPORTED"},
    ]


def test_semantic_match_requires_service_token(monkeypatch):
    client = _client(monkeypatch, [])
    try:
        response = client.post("/api/v1/semantic-match", headers={"X-Service-Token": "wrong"},
                               json={"jobId": "j1", "cvIds": ["a"]})
    finally:
        client.app.dependency_overrides.clear()

    assert response.status_code == 401
