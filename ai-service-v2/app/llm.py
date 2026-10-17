"""One Claude call per CV: read the document and judge every requirement with verbatim quotes.

The model never produces the score. It returns a status and quotes per requirement; code verifies
the quotes and computes the score (see scoring.py).
"""

from __future__ import annotations

import json
import logging
import time
from typing import Protocol

import anthropic
from pydantic import BaseModel, Field

from app.config import Settings
from app.documents import PreparedDocument
from app.schemas import Job

logger = logging.getLogger(__name__)

# Frozen: any byte change here invalidates the prompt cache for every request.
SYSTEM_PROMPT = """You are a recruitment screening assistant for HR Connect, a Vietnamese recruitment platform.
You read one candidate CV and judge it against the job requirements given by the employer. HR makes the hiring
decision; your job is to report what the CV proves, with evidence, so HR can check it quickly.

The CV may be in Vietnamese, English or both, in any industry (IT, marketing, sales, logistics, HR, finance...),
and may be a scanned image or a multi-column layout. Read it in natural reading order.

For each requirement, decide one status:
- MATCHED: the CV explicitly shows the requirement is met.
- PARTIAL: the CV shows related or incomplete evidence (a similar but different skill, fewer years than required,
  only some of several required items, an internship instead of a job).
- NOT_FOUND: the CV was readable and contains no evidence for it.
- UNKNOWN: the relevant part of the CV could not be read.

Rules:
- Evidence quotes must be copied word for word from the CV, as short as possible while still proving the point
  (one sentence or skill-list fragment each, at most 3 per requirement). Never paraphrase, translate or merge
  separate lines into one quote. Return no quotes for NOT_FOUND.
- Judge only what the CV states. Do not infer skills from a job title or company alone, and do not infer one
  skill from another (React does not prove "JavaScript" was stated; SQL Server does not prove MySQL).
- A quote must prove the requirement in the requirement's own domain. The same word in another field is not
  evidence: "performance marketing" or "campaign performance" is not software performance optimisation; building
  landing pages or SEO work is not web application development; "pipeline" in sales is not a CI/CD pipeline.
  When the only match is a shared word, the status is NOT_FOUND.
- A skill that appears only in a skills list, with no work or project that used it, is at most PARTIAL for
  requirements about experience, building, or optimising something. A plain SKILL requirement can be MATCHED by a
  skills list.
- PARTIAL needs concrete related evidence. Use NOT_FOUND rather than PARTIAL when the evidence is vague or generic
  ("hard-working", "fast learner", "familiar with technology").
- Alternatives with operator ANY_OF: one is enough. ALL_OF: every listed item is needed; if only some are present,
  use PARTIAL and name the missing ones in the reason.
- Experience requirements (category EXPERIENCE): count only roles in the field the requirement describes, not
  every job. Set relevant_years to the total years in those roles up to today (overlapping periods count once;
  internships count at half; student clubs, unions and volunteer activities are not work experience and count 0).
  Use PARTIAL when there is relevant experience but fewer years than required.
- Keep each reason to one short sentence in Vietnamese.
- candidate_summary: two sentences in Vietnamese describing the candidate's field and seniority.
- overall_fit: how well the candidate fits THIS job overall, as an experienced recruiter would judge it from
  field, seniority, depth and recency of relevant work (not by counting keywords). Choose one level:
    5 = same field and seniority, has done work of the same kind and scale as the job;
    4 = same field, minor gaps (slightly junior, one secondary technology missing);
    3 = adjacent profile that could grow into the job (related field, or clearly too junior);
    2 = different main field with a few transferable skills;
    1 = unrelated to the job.
  Give one short Vietnamese reason and 1-3 verbatim quotes that support levels 3-5 (none needed for 1-2).
- cv_text: follow the transcription instruction at the end of the request."""


class LlmRequirementJudgement(BaseModel):
    requirement_id: str
    status: str
    evidence_quotes: list[str]
    reason: str
    relevant_years: float | None = None


class LlmOverallFit(BaseModel):
    level: int
    reason: str
    evidence_quotes: list[str]


class LlmCvAssessment(BaseModel):
    candidate_summary: str
    cv_text: str
    requirements: list[LlmRequirementJudgement]
    overall_fit: LlmOverallFit
    unreadable_parts: str = Field(default="")


# Strict JSON schema for output_config.format (all properties required, no extras).
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "candidate_summary": {"type": "string"},
        "cv_text": {"type": "string"},
        "unreadable_parts": {"type": "string", "description": "Empty if the whole CV was readable."},
        "requirements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "requirement_id": {"type": "string"},
                    "status": {"type": "string", "enum": ["MATCHED", "PARTIAL", "NOT_FOUND", "UNKNOWN"]},
                    "evidence_quotes": {"type": "array", "items": {"type": "string"}},
                    "reason": {"type": "string"},
                    "relevant_years": {"type": ["number", "null"]},
                },
                "required": ["requirement_id", "status", "evidence_quotes", "reason", "relevant_years"],
                "additionalProperties": False,
            },
        },
        "overall_fit": {
            "type": "object",
            "properties": {
                "level": {"type": "integer", "enum": [1, 2, 3, 4, 5]},
                "reason": {"type": "string"},
                "evidence_quotes": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["level", "reason", "evidence_quotes"],
            "additionalProperties": False,
        },
    },
    "required": ["candidate_summary", "cv_text", "unreadable_parts", "requirements", "overall_fit"],
    "additionalProperties": False,
}


class LlmError(RuntimeError):
    """The model could not produce a usable assessment; the caller routes the CV to manual review."""


class CvAssessor(Protocol):
    def assess(self, job: Job, document: PreparedDocument, today: str) -> LlmCvAssessment: ...


def needs_transcription(document: PreparedDocument) -> bool:
    """Only scans, images and image-only pages need the model's transcription to check quotes."""
    return not document.has_text_layer or bool(document.image_only_pages)


def instruction(today: str, transcribe: bool = True) -> str:
    cv_text_rule = (
        "Set cv_text to a faithful plain-text transcription of the whole CV in reading order."
        if transcribe
        else 'The CV has a text layer, so set cv_text to an empty string "".'
    )
    return (f"Today is {today}. Judge the CV above against every requirement in the job, "
            f"returning exactly one entry per requirement id. {cv_text_rule}")


def job_prompt(job: Job) -> str:
    """Deterministic rendering (sorted keys) so the same job always produces the same cacheable bytes."""
    payload = {
        "title": job.title,
        "description": job.description,
        "requirements": [
            requirement.model_dump(by_alias=True, exclude_none=True, mode="json") for requirement in job.requirements
        ],
    }
    return "<job>\n" + json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=1) + "\n</job>"


class ClaudeCvAssessor:
    def __init__(self, settings: Settings, client: anthropic.Anthropic | None = None) -> None:
        self._settings = settings
        self._client = client or anthropic.Anthropic(timeout=settings.llm_timeout_seconds)

    def assess(self, job: Job, document: PreparedDocument, today: str) -> LlmCvAssessment:
        if document.kind == "text":
            cv_block = {"type": "text", "text": f"<cv>\n{document.source_text}\n</cv>"}
        else:
            cv_block = {"type": "document" if document.kind == "pdf" else "image",
                        "source": {"type": "base64", "media_type": document.media_type, "data": document.base64_data}}
        content = [
            # Job first and cached: every CV screened for the same job reuses this prefix.
            {"type": "text", "text": job_prompt(job), "cache_control": {"type": "ephemeral"}},
            cv_block,
            {"type": "text", "text": instruction(today, needs_transcription(document))},
        ]
        try:
            response = self._client.messages.create(
                model=self._settings.llm_model,
                max_tokens=self._settings.llm_max_tokens,
                system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": content}],
                output_config={
                    "effort": self._settings.llm_effort,
                    "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA},
                },
            )
        except anthropic.RateLimitError as exc:
            raise LlmError("LLM rate limited; retry later.") from exc
        except anthropic.APIStatusError as exc:
            raise LlmError(f"LLM request failed ({exc.status_code}).") from exc
        except anthropic.APIConnectionError as exc:
            raise LlmError("Could not reach the LLM service.") from exc

        if response.stop_reason == "refusal":
            raise LlmError("The model declined to assess this CV.")
        if response.stop_reason == "max_tokens":
            raise LlmError("The assessment was cut off (max_tokens); raise LLM_MAX_TOKENS.")

        text = next((block.text for block in response.content if block.type == "text"), None)
        if text is None:
            raise LlmError("The model returned no assessment.")
        return LlmCvAssessment.model_validate_json(text)


class GeminiCvAssessor:
    """Google Gemini via the Interactions API (google-genai). Reads PDF and images inline."""

    def __init__(self, settings: Settings, client=None) -> None:
        from google import genai
        from google.genai import types

        if client is None and not settings.gemini_api_key:
            raise LlmError("GEMINI_API_KEY is not set.")
        self._settings = settings
        # Without a timeout one stuck Gemini call blocks the single scoring worker for ever (milliseconds).
        self._client = client or genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(timeout=int(settings.llm_timeout_seconds * 1000)))
        self.last_model = ""

    def assess(self, job: Job, document: PreparedDocument, today: str) -> LlmCvAssessment:
        if document.kind == "text":
            cv_item = {"type": "text", "text": f"<cv>\n{document.source_text}\n</cv>"}
        else:
            cv_item = {"type": "document" if document.kind == "pdf" else "image",
                       "data": document.base64_data, "mime_type": document.media_type}
        request = {
            "input": [
                {"type": "text", "text": SYSTEM_PROMPT},
                {"type": "text", "text": job_prompt(job)},
                cv_item,
                {"type": "text", "text": instruction(today, needs_transcription(document))},
            ],
            "response_format": {"type": "text", "mime_type": "application/json",
                                "schema": LlmCvAssessment.model_json_schema()},
            # Same CV + JD should give the same judgement: screening must be repeatable.
            "generation_config": {"temperature": self._settings.llm_temperature, "seed": self._settings.llm_seed},
        }
        # Quota is counted per model, so a rate-limited model hands over to the next one on the same key.
        models = list(dict.fromkeys([self._settings.gemini_model, *self._settings.gemini_fallback_model_list]))
        for index, model in enumerate(models):
            is_last = index == len(models) - 1
            for attempt in range(1, self._settings.llm_max_attempts + 1):
                try:
                    started = time.monotonic()
                    logger.info("Gemini call model=%s attempt=%s", model, attempt)
                    interaction = self._client.interactions.create(model=model, **request)
                    result = _parse(getattr(interaction, "output_text", None))
                    self.last_model = model
                    logger.info("Gemini answered model=%s in %.1fs", model, time.monotonic() - started)
                    return result
                except LlmError:
                    raise
                except Exception as exc:  # the SDK raises several transport/API error types
                    logger.warning("Gemini call failed model=%s attempt=%s: %s", model, attempt, type(exc).__name__)
                    if not _is_rate_limit(exc):
                        raise LlmError(f"Gemini request failed: {type(exc).__name__}: {str(exc)[:200]}") from exc
                    if not is_last:
                        break  # switch model now instead of waiting
                    if attempt == self._settings.llm_max_attempts:
                        raise LlmError(f"All Gemini models are rate limited ({', '.join(models)}).") from exc
                    # Last model: wait for the per-minute window to reset.
                    time.sleep(self._settings.llm_retry_wait_seconds * attempt)
        raise LlmError("Gemini request failed after retries.")


class OpenAiCvAssessor:
    """OpenAI GPT via the Responses API with strict Structured Outputs."""

    def __init__(self, settings: Settings, client=None) -> None:
        from openai import OpenAI

        self._settings = settings
        if client is None and not settings.openai_api_key:
            raise LlmError("OPENAI_API_KEY is not set.")
        self._client = client or OpenAI(api_key=settings.openai_api_key, timeout=settings.llm_timeout_seconds)

    def assess(self, job: Job, document: PreparedDocument, today: str) -> LlmCvAssessment:
        if document.kind == "pdf":
            cv_item = {"type": "input_file", "filename": "cv.pdf",
                       "file_data": f"data:application/pdf;base64,{document.base64_data}"}
        elif document.kind == "image":
            cv_item = {"type": "input_image", "image_url": f"data:{document.media_type};base64,{document.base64_data}"}
        else:
            cv_item = {"type": "input_text", "text": f"<cv>\n{document.source_text}\n</cv>"}
        try:
            response = self._client.responses.create(
                model=self._settings.openai_model,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": [
                        {"type": "input_text", "text": job_prompt(job)},
                        cv_item,
                        {"type": "input_text", "text": instruction(today, needs_transcription(document))},
                    ]},
                ],
                text={"format": {"type": "json_schema", "name": "cv_assessment",
                                 "schema": OUTPUT_SCHEMA, "strict": True}},
            )
        except Exception as exc:
            raise LlmError(f"OpenAI request failed: {type(exc).__name__}: {str(exc)[:200]}") from exc
        return _parse(getattr(response, "output_text", None))


class FallbackCvAssessor:
    """Tries each provider in order; the next one runs only when the previous raised LlmError."""

    def __init__(self, assessors: list[tuple[str, CvAssessor]]) -> None:
        self._assessors = assessors
        self.last_provider = ""

    def assess(self, job: Job, document: PreparedDocument, today: str) -> LlmCvAssessment:
        errors = []
        for name, assessor in self._assessors:
            try:
                result = assessor.assess(job, document, today)
                self.last_provider = name
                return result
            except LlmError as exc:
                errors.append(f"{name}: {exc}")
        raise LlmError(" | ".join(errors))


def _is_rate_limit(exc: Exception) -> bool:
    text = f"{type(exc).__name__} {exc}".upper()
    return "429" in text or "RESOURCE_EXHAUSTED" in text or "RATE" in text and "LIMIT" in text


def _parse(text: str | None) -> LlmCvAssessment:
    if not text:
        raise LlmError("The model returned no assessment.")
    try:
        return LlmCvAssessment.model_validate_json(text)
    except ValueError as exc:
        raise LlmError("The model returned JSON that does not match the schema.") from exc


_PROVIDERS = {
    "gemini": GeminiCvAssessor,
    "openai": OpenAiCvAssessor,
    "anthropic": ClaudeCvAssessor,
}


def _single(provider: str, settings: Settings) -> CvAssessor:
    try:
        return _PROVIDERS[provider](settings)
    except KeyError:
        raise ValueError(f"Unknown LLM provider '{provider}'. Use {', '.join(_PROVIDERS)}.") from None


def make_assessor(settings: Settings) -> CvAssessor:
    """LLM_PROVIDER first, then each LLM_FALLBACK_PROVIDERS entry (comma-separated) when it fails."""
    names = [settings.llm_provider.strip().lower()]
    names += [name.strip().lower() for name in settings.llm_fallback_providers.split(",") if name.strip()]
    names = list(dict.fromkeys(names))
    if len(names) == 1:
        return _single(names[0], settings)
    return FallbackCvAssessor([(name, _single(name, settings)) for name in names])
