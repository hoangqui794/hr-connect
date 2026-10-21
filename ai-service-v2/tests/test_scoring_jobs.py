import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.documents import PreparedDocument
from app.llm import LlmError
from app.pipeline import MatchingPipeline
from app.schemas import Job
from app.scoring_jobs import ScoringJobRequest, ScoringOrchestrator
from tests.test_pipeline import REQS, FakeAssessor, FakeSemantic

JOB = {"jobId": "j1", "title": "Senior .NET Developer", "description": "Build APIs", "requirements": REQS}
JUDGEMENTS = [
    {"requirement_id": "dotnet", "status": "MATCHED", "evidence_quotes": ["Built REST APIs with ASP.NET Core and C#"], "reason": "C#"},
    {"requirement_id": "years", "status": "NOT_FOUND", "evidence_quotes": [], "reason": "no"},
    {"requirement_id": "clean", "status": "MATCHED", "evidence_quotes": ["Applied Clean Architecture and design patterns."], "reason": "ok"},
    {"requirement_id": "mentoring", "status": "MATCHED", "evidence_quotes": ["reviewed code"], "reason": "ok"},
]
SCORING_JOB = ScoringJobRequest(requestId="req-1", applicationId="app-1", cvId="cv-1", jobId="j1", attemptNo=2)


def test_backend_jd_without_ids_gets_sequential_ids():
    job = Job.model_validate({"title": "t", "requirements": [
        {"type": "MUST_HAVE", "content": "C#"},
        {"id": "r1", "type": "SHOULD_HAVE", "content": "SQL"},
        {"type": "SHOULD_HAVE", "content": "Docker"},
    ]})
    ids = [requirement.id for requirement in job.requirements]
    assert ids == ["r2", "r1", "r3"]
    assert len(set(ids)) == 3


class FakeClient:
    def __init__(self):
        self.posted = []

    async def get_cv_metadata(self, cv_id):
        return {"downloadUrl": "https://storage/cv.pdf", "fileName": "cv.txt"}

    async def get_job(self, job_id):
        return Job.model_validate(JOB)

    async def download_cv(self, url):
        from tests.test_pipeline import CV_TEXT
        return CV_TEXT.encode("utf-8")

    async def post_ai_result(self, payload):
        self.posted.append(payload)


def orchestrator(client, assessor):
    settings = Settings()
    return ScoringOrchestrator(settings, client, lambda: MatchingPipeline(settings, assessor, FakeSemantic()))


def test_completed_callback_has_backend_fields(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr("app.scoring_jobs.prepare_document", lambda name, data: PreparedDocument(
        kind="text", media_type="text/plain", data=data, source_text=data.decode(),
        extraction_method="TEXT", has_text_layer=True, page_count=1, image_only_pages=[]))
    asyncio.run(orchestrator(client, FakeAssessor(JUDGEMENTS)).process(SCORING_JOB))

    payload = client.posted[-1]
    assert payload["status"] == "COMPLETED"
    assert (payload["requestId"], payload["applicationId"], payload["cvId"], payload["jobId"], payload["attemptNo"]) == (
        "req-1", "app-1", "cv-1", "j1", 2)
    assert 0 <= payload["score"] <= 59  # a MUST_HAVE is NOT_FOUND -> knockout cap
    assert payload["missingRequirements"] == ["5 years .NET: cần 5 năm, CV không thể hiện kinh nghiệm liên quan"]
    assert payload["mustHaveResult"][0]["requirement"] == "C# and .NET"
    assert payload["mustHaveResult"][0]["matched"] is True
    highlights = payload["candidateHighlights"]
    assert highlights[0] == "Lập trình viên .NET."
    assert highlights[1].startswith("Mức phù hợp tổng thể:")
    # Each requirement highlight names the requirement and quotes the verified CV line, MUST_HAVE first.
    assert highlights[2] == 'Đạt - C# and .NET: "Built REST APIs with ASP.NET Core and C#"'
    assert highlights[3] == 'Đạt - Clean Architecture: "Applied Clean Architecture and design patterns."'
    assert payload["matchingReasons"][0] == "Yêu cầu bắt buộc: đạt 2/3, một phần 0"
    assert payload["structuredCvData"] is None
    assert len(payload["inputFingerprints"]["cvSha256"]) == 64


def test_llm_outage_reports_failed_not_rejection(monkeypatch):
    class DownAssessor:
        def assess(self, *args):
            raise LlmError("quota")

    client = FakeClient()
    monkeypatch.setattr("app.scoring_jobs.prepare_document", lambda name, data: PreparedDocument(
        kind="text", media_type="text/plain", data=data, source_text=data.decode(),
        extraction_method="TEXT", has_text_layer=True, page_count=1, image_only_pages=[]))
    asyncio.run(orchestrator(client, DownAssessor()).process(SCORING_JOB))

    assert client.posted[-1]["status"] == "FAILED"
    assert client.posted[-1]["errorCode"] == "AI_PROVIDER_UNAVAILABLE"
    assert "score" not in client.posted[-1]


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setenv("HRCONNECT_SERVICE_TOKEN", "secret-token")
    get_settings.cache_clear()
    from app.main import app
    with TestClient(app) as client:
        yield client
    get_settings.cache_clear()


def body():
    return {"requestId": "req-9", "applicationId": "a", "cvId": "c", "jobId": "j", "attemptNo": 1}


def test_scoring_job_requires_service_token(api):
    assert api.post("/api/v1/scoring-jobs", json=body()).status_code == 401
    assert api.post("/api/v1/scoring-jobs", json=body(), headers={"X-Service-Token": "wrong"}).status_code == 401


def test_scoring_job_is_accepted(api, monkeypatch):
    seen = []

    async def fake_enqueue(job):
        seen.append(job.request_id)
        return True

    monkeypatch.setattr("app.scoring_jobs.scoring_job_queue.enqueue", fake_enqueue)
    response = api.post("/api/v1/scoring-jobs", json=body(), headers={"X-Service-Token": "secret-token"})
    assert response.status_code == 202
    assert response.json() == {"requestId": "req-9", "status": "ACCEPTED"}
    assert seen == ["req-9"]


def test_marketing_years_gap_is_explained():
    from app.schemas import MatchStatus, Requirement, RequirementResult
    from app.scoring_jobs import _years_gap

    requirement = Requirement(id="experience", type="MUST_HAVE", category="EXPERIENCE",
                              content="More than 3 years of Marketing Communications experience", minYears=3)
    item = RequirementResult(requirement=requirement, type=requirement.type, matchStatus=MatchStatus.PARTIAL,
                             relevantYears=2.5, matchMethod="LLM_YEARS_BELOW_MIN")
    assert _years_gap(item) == "cần 3 năm, CV thể hiện khoảng 2.5 năm"


def test_slow_scoring_reports_timeout_not_hang(monkeypatch):
    import time as _time

    class SlowAssessor:
        def assess(self, *args):
            _time.sleep(1.0)
            raise LlmError("too late")

    client = FakeClient()
    monkeypatch.setattr("app.scoring_jobs.prepare_document", lambda name, data: PreparedDocument(
        kind="text", media_type="text/plain", data=data, source_text=data.decode(),
        extraction_method="TEXT", has_text_layer=True, page_count=1, image_only_pages=[]))
    settings = Settings(scoring_job_timeout_seconds=0.2)
    slow = ScoringOrchestrator(settings, client, lambda: MatchingPipeline(settings, SlowAssessor(), FakeSemantic()))

    asyncio.run(slow.process(SCORING_JOB))

    assert client.posted[-1]["status"] == "FAILED"
    assert client.posted[-1]["errorCode"] == "AI_TIMEOUT"


def test_match_file_requires_service_token_by_default(api):
    files = {"file": ("cv.txt", b"C# developer", "text/plain")}
    data = {"metadata": "{}"}
    assert api.post("/api/v1/match-file", files=files, data=data).status_code == 401
    # With the token the request reaches validation (empty metadata is rejected, not the caller).
    assert api.post("/api/v1/match-file", files=files, data=data,
                    headers={"X-Service-Token": "secret-token"}).status_code == 422


def test_docs_are_not_served_by_default(api):
    assert api.get("/docs").status_code == 404
    assert api.get("/openapi.json").status_code == 404


class _BlockingOrchestrator:
    """Never finishes a job, like a service killed mid-scoring."""

    def __init__(self) -> None:
        self.seen: list[str] = []

    async def process(self, job):
        self.seen.append(job.request_id)
        await asyncio.Event().wait()

    async def callback_failed(self, job, code, message):
        pass


@pytest.mark.anyio
async def test_unfinished_jobs_survive_a_restart(tmp_path):
    from app.scoring_jobs import ScoringJobQueue, ScoringJobRequest

    settings = Settings(scoring_queue_file=str(tmp_path / "q.json"), scoring_worker_count=1)
    first = ScoringJobQueue()
    await first.start(settings, _BlockingOrchestrator())
    for rid in ("r1", "r2"):
        await first.enqueue(ScoringJobRequest(requestId=rid, applicationId="a", cvId="c", jobId="j", attemptNo=1))
    await first.stop()

    restarted = _BlockingOrchestrator()
    second = ScoringJobQueue()
    await second.start(settings, restarted)
    await asyncio.sleep(0.05)
    await second.stop()
    assert restarted.seen == ["r1"]  # one worker: r1 is picked up again, r2 waits behind it
    assert {item["requestId"] for item in json.loads((tmp_path / "q.json").read_text())} == {"r1", "r2"}


@pytest.mark.anyio
async def test_finished_job_is_removed_from_the_file(tmp_path):
    from app.scoring_jobs import ScoringJobQueue, ScoringJobRequest

    class Done:
        async def process(self, job):
            return None

        async def callback_failed(self, job, code, message):
            pass

    settings = Settings(scoring_queue_file=str(tmp_path / "q.json"), scoring_worker_count=1)
    queue = ScoringJobQueue()
    await queue.start(settings, Done())
    await queue.enqueue(ScoringJobRequest(requestId="r1", applicationId="a", cvId="c", jobId="j", attemptNo=1))
    await asyncio.sleep(0.05)
    await queue.stop()
    assert json.loads((tmp_path / "q.json").read_text()) == []


@pytest.fixture
def anyio_backend():
    return "asyncio"
