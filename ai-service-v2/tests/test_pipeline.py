from datetime import date

import pytest

from app.config import Settings
from app.documents import PreparedDocument
from app.llm import LlmCvAssessment, LlmOverallFit, LlmRequirementJudgement, job_prompt, needs_transcription, instruction
from app.pipeline import MatchingPipeline
from app.schemas import MatchingMetadata, MatchStatus
from app.verification import quote_occurs

CV_TEXT = """Nguyễn Văn A — Senior .NET Developer
Built REST APIs with ASP.NET Core and C# for an ERP system.
Applied Clean Architecture and design patterns.
Software Engineer, ABC Corp, 01/2021 – nay
Led a team of 4 developers and reviewed code."""


def metadata(requirements):
    return MatchingMetadata.model_validate({
        "requestId": "r1", "applicationId": "a1", "attemptNo": 1,
        "job": {"title": "Senior .NET Developer", "description": "Build APIs", "requirements": requirements},
    })


REQS = [
    {"id": "dotnet", "type": "MUST_HAVE", "category": "SKILL", "content": "C# and .NET"},
    {"id": "years", "type": "MUST_HAVE", "category": "EXPERIENCE", "content": "5 years .NET", "minYears": 5},
    {"id": "clean", "type": "MUST_HAVE", "category": "SKILL", "content": "Clean Architecture"},
    {"id": "mentoring", "type": "SHOULD_HAVE", "category": "OTHER", "content": "Code review or mentoring"},
]


class FakeAssessor:
    def __init__(self, judgements, cv_text=CV_TEXT, unreadable="", fit=None):
        self.judgements = judgements
        self.fit = fit or LlmOverallFit(level=5, reason="r", evidence_quotes=["Applied Clean Architecture and design patterns."])
        self.cv_text = cv_text
        self.unreadable = unreadable
        self.calls = 0

    def assess(self, job, document, today):
        self.calls += 1
        return LlmCvAssessment(
            candidate_summary="Lập trình viên .NET.",
            cv_text=self.cv_text,
            unreadable_parts=self.unreadable,
            requirements=[LlmRequirementJudgement(**j) for j in self.judgements],
            overall_fit=self.fit,
        )


class FakeSemantic:
    def __init__(self, value=0.8):
        self.value = value

    def similarity(self, cv_text, job):
        return self.value


def j(rid, status, quotes=(), years=None):
    return {"requirement_id": rid, "status": status, "evidence_quotes": list(quotes), "reason": "r",
            "relevant_years": years}


def pdf_document(text=CV_TEXT):
    return PreparedDocument(kind="pdf", media_type="application/pdf", data=b"", source_text=text,
                            extraction_method="PDF_TEXT_AND_VISION", has_text_layer=True, page_count=1)


def run(judgements, document=None, semantic=0.8, settings=None, unreadable="", fit=None):
    settings = settings or Settings(_env_file=None)
    pipeline = MatchingPipeline(settings, FakeAssessor(judgements, unreadable=unreadable, fit=fit), FakeSemantic(semantic))
    return pipeline.run(metadata(REQS), document or pdf_document(), today=date(2026, 10, 14))


def statuses(result):
    return {r.requirement.id: r.match_status for r in result.must_have_result + result.should_have_result}


def test_verified_quotes_keep_the_model_status():
    result = run([
        j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."]),
        j("years", "MATCHED", ["Software Engineer, ABC Corp, 01/2021 – nay"], years=5.8),
        j("clean", "MATCHED", ["Applied Clean Architecture and design patterns."]),
        j("mentoring", "MATCHED", ["Led a team of 4 developers and reviewed code."]),
    ])
    assert set(statuses(result).values()) == {MatchStatus.MATCHED}
    assert result.match_score == pytest.approx(100 * (0.5 + 0.2 + 0.15 * 0.8 + 0.15 * 1.0))
    assert result.overall_fit.level == 5
    assert result.requires_manual_review is False


def test_invented_quote_never_raises_the_score():
    result = run([
        j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."]),
        j("years", "MATCHED", ["Software Engineer, ABC Corp, 01/2021 – nay"], years=5.8),
        j("clean", "MATCHED", ["Expert in Kubernetes and Clean Architecture at Google for 10 years"]),
        j("mentoring", "NOT_FOUND"),
    ])
    clean = next(r for r in result.must_have_result if r.requirement.id == "clean")
    assert clean.match_status == MatchStatus.NOT_FOUND
    assert clean.match_method == "LLM_UNVERIFIED"
    assert clean.evidence == []
    assert clean.unverified_evidence
    assert result.requires_manual_review is True


def test_years_threshold_is_rechecked_in_code():
    result = run([
        j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."]),
        j("years", "MATCHED", ["Software Engineer, ABC Corp, 01/2021 – nay"], years=3.0),
        j("clean", "MATCHED", ["Applied Clean Architecture and design patterns."]),
        j("mentoring", "NOT_FOUND"),
    ])
    years = next(r for r in result.must_have_result if r.requirement.id == "years")
    assert years.match_status == MatchStatus.PARTIAL
    assert years.match_method == "LLM_YEARS_BELOW_MIN"


@pytest.mark.parametrize("model_status", ["MATCHED", "PARTIAL"])
def test_years_just_under_minimum_count_as_met(model_status):
    result = run([
        j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."]),
        j("years", model_status, ["Software Engineer, ABC Corp, 01/2021 – nay"], years=4.8),
        j("clean", "MATCHED", ["Applied Clean Architecture and design patterns."]),
        j("mentoring", "NOT_FOUND"),
    ])
    years = next(r for r in result.must_have_result if r.requirement.id == "years")
    assert years.match_status == MatchStatus.MATCHED  # 4.8 >= 5 - 0.25
    assert years.match_method == "LLM_YEARS_WITHIN_TOLERANCE"


def test_years_tolerance_is_configurable():
    result = run([
        j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."]),
        j("years", "MATCHED", ["Software Engineer, ABC Corp, 01/2021 – nay"], years=4.8),
        j("clean", "MATCHED", ["Applied Clean Architecture and design patterns."]),
        j("mentoring", "NOT_FOUND"),
    ], settings=Settings(_env_file=None, years_tolerance=0.0))
    years = next(r for r in result.must_have_result if r.requirement.id == "years")
    assert years.match_status == MatchStatus.PARTIAL


def test_missing_must_have_caps_the_score():
    result = run([
        j("dotnet", "NOT_FOUND"),
        j("years", "MATCHED", ["Software Engineer, ABC Corp, 01/2021 – nay"], years=6),
        j("clean", "MATCHED", ["Applied Clean Architecture and design patterns."]),
        j("mentoring", "MATCHED", ["Led a team of 4 developers and reviewed code."]),
    ], semantic=1.0)
    assert result.match_score <= 59.0


def test_requirement_the_model_skipped_is_unknown_and_reviewed():
    result = run([j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."])])
    assert statuses(result)["years"] == MatchStatus.UNKNOWN
    assert result.requires_manual_review is True
    assert any("years" in reason for reason in result.review_reasons)


def test_scanned_cv_is_always_flagged_for_review():
    scan = PreparedDocument(kind="pdf", media_type="application/pdf", data=b"", source_text="", extraction_method="PDF_VISION",
                            has_text_layer=False, page_count=1)
    result = run([j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."])],
                 document=scan)
    # Quote checked against the model's transcription, but the CV still goes to a human.
    dotnet = next(r for r in result.must_have_result if r.requirement.id == "dotnet")
    assert dotnet.match_status == MatchStatus.MATCHED
    assert result.requires_manual_review is True


def test_quote_matching_tolerates_ligatures_case_and_line_breaks():
    source = "Built a notiﬁcation center and\nreal-time   CHAT features"
    assert quote_occurs("built a notification center and real-time chat features", source, 0.85)
    assert not quote_occurs("built a payment gateway", source, 0.85)
    assert not quote_occurs("Java", "JavaScript developer", 0.85)


def test_job_prompt_is_byte_stable_for_caching():
    first = job_prompt(metadata(REQS).job)
    second = job_prompt(metadata(list(REQS)).job)
    assert first == second


def test_quote_from_an_image_only_page_is_kept_but_reviewed():
    doc = PreparedDocument(kind="pdf", media_type="application/pdf", data=b"", source_text="Page two text only.",
                           extraction_method="PDF_TEXT_AND_VISION", has_text_layer=True, page_count=2,
                           image_only_pages=[1])
    result = run([j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."])],
                 document=doc)
    dotnet = next(r for r in result.must_have_result if r.requirement.id == "dotnet")
    assert dotnet.match_status == MatchStatus.MATCHED  # found in the transcription of page 1
    assert result.requires_manual_review is True
    assert any("Trang 1" in reason for reason in result.review_reasons)


def test_good_fit_without_a_real_quote_is_lowered():
    fit = LlmOverallFit(level=5, reason="r", evidence_quotes=["Ten years leading Google search infrastructure"])
    result = run([j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."])], fit=fit)
    assert result.overall_fit.level == 2
    assert result.overall_fit.adjusted is True
    assert result.requires_manual_review is True


def test_low_fit_needs_no_quote():
    fit = LlmOverallFit(level=1, reason="unrelated", evidence_quotes=[])
    result = run([j("dotnet", "NOT_FOUND")], fit=fit)
    assert result.overall_fit.level == 1
    assert result.overall_fit.score == 0.0
    assert result.overall_fit.adjusted is False


def test_transcription_is_requested_only_when_pages_are_images():
    text_pdf = pdf_document()
    scan = PreparedDocument(kind="pdf", media_type="application/pdf", data=b"", source_text="",
                            extraction_method="PDF_VISION", has_text_layer=False, page_count=1)
    mixed = PreparedDocument(kind="pdf", media_type="application/pdf", data=b"", source_text="x",
                             extraction_method="PDF_TEXT_AND_VISION", has_text_layer=True, page_count=2,
                             image_only_pages=[1])
    assert needs_transcription(text_pdf) is False
    assert needs_transcription(scan) is True
    assert needs_transcription(mixed) is True
    assert '""' in instruction("2026-10-14", transcribe=False)


def test_fallback_provider_answers_when_primary_fails():
    from app.llm import FallbackCvAssessor, LlmError

    class Down:
        def assess(self, *args):
            raise LlmError("quota")

    backup = FakeAssessor([j("dotnet", "MATCHED", ["Built REST APIs with ASP.NET Core and C# for an ERP system."])])
    settings = Settings(_env_file=None, llm_provider="gemini", openai_model="gpt-5.4-mini")
    pipeline = MatchingPipeline(settings, FallbackCvAssessor([("gemini", Down()), ("openai", backup)]), FakeSemantic())
    result = pipeline.run(metadata(REQS), pdf_document(), today=date(2026, 10, 14))
    assert backup.calls == 1
    assert result.model_name.startswith("gpt-5.4-mini")


def test_all_providers_failing_raises_llm_error():
    from app.llm import FallbackCvAssessor, LlmError

    class Down:
        def assess(self, *args):
            raise LlmError("down")

    with pytest.raises(LlmError, match="gemini: down | openai: down"):
        FallbackCvAssessor([("gemini", Down()), ("openai", Down())]).assess(None, None, "")



class FakeGeminiClient:
    """interactions.create fails with 429 for the models in `limited`."""

    def __init__(self, limited):
        self.limited = set(limited)
        self.models = []
        self.interactions = self

    def create(self, model, **request):
        self.models.append(model)
        if model in self.limited:
            raise RuntimeError("429 RESOURCE_EXHAUSTED")

        class Reply:
            output_text = LlmCvAssessment(candidate_summary="s", cv_text="", unreadable_parts="", requirements=[],
                                          overall_fit=LlmOverallFit(level=1, reason="r", evidence_quotes=[])
                                          ).model_dump_json()
        return Reply()


def gemini(limited, fallbacks="gemini-b"):
    from app.llm import GeminiCvAssessor

    settings = Settings(_env_file=None, gemini_model="gemini-a", gemini_fallback_models=fallbacks,
                        llm_retry_wait_seconds=0)
    return GeminiCvAssessor(settings, client=FakeGeminiClient(limited))


def test_rate_limited_gemini_model_switches_to_fallback_model_on_same_key():
    assessor = gemini(limited=["gemini-a"])
    assessor.assess(metadata(REQS).job, pdf_document(), "2026-10-14")
    assert assessor._client.models == ["gemini-a", "gemini-b"]  # switched at once, no waiting
    assert assessor.last_model == "gemini-b"


def test_all_gemini_models_limited_raises_after_retrying_the_last():
    from app.llm import LlmError

    assessor = gemini(limited=["gemini-a", "gemini-b"])
    with pytest.raises(LlmError, match="All Gemini models are rate limited"):
        assessor.assess(metadata(REQS).job, pdf_document(), "2026-10-14")
    assert assessor._client.models == ["gemini-a"] + ["gemini-b"] * 3
