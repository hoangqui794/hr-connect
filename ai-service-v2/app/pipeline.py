"""CV + job -> verified, scored matching result (the diagram in README.md)."""

from __future__ import annotations

from datetime import date

from app.config import Settings
from app.documents import PreparedDocument
from app.llm import CvAssessor, LlmCvAssessment
from app.schemas import (
    MatchingMetadata,
    MatchingResult,
    MatchStatus,
    OverallFit,
    Requirement,
    RequirementResult,
)
from app.scoring import compute_score, fit_score, split_by_type
from app.semantic import SemanticMatcher
from app.verification import split_quotes


class MatchingPipeline:
    def __init__(self, settings: Settings, assessor: CvAssessor, semantic: SemanticMatcher) -> None:
        self._settings = settings
        self._assessor = assessor
        self._semantic = semantic

    def run(self, metadata: MatchingMetadata, document: PreparedDocument, today: date | None = None) -> MatchingResult:
        job = metadata.job
        assessment = self._assessor.assess(job, document, (today or date.today()).isoformat())

        # Quotes are checked against text read locally when we have it; for scans and images the
        # model's own transcription is the only text, which cannot prove anything independently.
        verification_text = document.source_text or assessment.cv_text
        review_reasons: list[str] = []
        if document.image_only_pages:
            # Some pages are images: their text exists only in the model's transcription.
            verification_text = f"{document.source_text}\n{assessment.cv_text}"
            pages = ", ".join(map(str, document.image_only_pages))
            review_reasons.append(
                f"Trang {pages} của CV là ảnh: bằng chứng từ các trang này chỉ đối chiếu được với bản chép lại của AI.")
        if not document.has_text_layer:
            review_reasons.append("CV là ảnh/scan: bằng chứng chỉ đối chiếu được với bản chép lại của AI.")
        if assessment.unreadable_parts.strip():
            review_reasons.append(f"Có phần không đọc được: {assessment.unreadable_parts.strip()}")

        judgements = {judgement.requirement_id: judgement for judgement in assessment.requirements}
        results = [
            self._verify(requirement, judgements.get(requirement.id), verification_text, review_reasons)
            for requirement in job.requirements
        ]

        must, should = split_by_type(results)
        semantic = self._semantic.similarity(verification_text, job)
        overall_fit = self._verify_fit(assessment, verification_text)
        if overall_fit.adjusted:
            review_reasons.append("Mức phù hợp tổng thể của AI không có câu trích hợp lệ nên bị hạ xuống mức 2.")
        score = compute_score(must, should, semantic, self._settings, overall_fit.score)
        manual_review = bool(review_reasons) or any(result.requires_manual_review for result in results)

        return MatchingResult(
            requestId=metadata.request_id,
            applicationId=metadata.application_id,
            attemptNo=metadata.attempt_no,
            matchScore=score,
            semanticScore=semantic,
            overallFit=overall_fit,
            mustHaveResult=must,
            shouldHaveResult=should,
            candidateSummary=assessment.candidate_summary,
            requiresManualReview=manual_review,
            reviewReasons=review_reasons,
            modelName=f"{self._settings.active_model} + {self._settings.embedding_model}",
        )

    def _verify_fit(self, assessment: LlmCvAssessment, source: str) -> OverallFit:
        fit = assessment.overall_fit
        level = min(5, max(1, fit.level))
        verified, unverified = split_quotes(fit.evidence_quotes, source, self._settings.quote_min_token_ratio)
        adjusted = False
        if level >= 3 and not verified:
            # A good fit must be backed by something actually in the CV.
            level, adjusted = 2, True
        return OverallFit(level=level, score=fit_score(level), reason=fit.reason, evidence=verified,
                          unverifiedEvidence=unverified, adjusted=adjusted)

    def _verify(self, requirement: Requirement, judgement, source: str, review_reasons: list[str]) -> RequirementResult:
        if judgement is None:
            review_reasons.append(f"AI không trả kết quả cho yêu cầu '{requirement.id}'.")
            return self._result(requirement, MatchStatus.UNKNOWN, [], [], "AI không đánh giá yêu cầu này.", None,
                                "MISSING", True)

        status = _parse_status(judgement.status)
        verified, unverified = split_quotes(judgement.evidence_quotes, source, self._settings.quote_min_token_ratio)
        method = "LLM_VERIFIED"
        manual = status == MatchStatus.UNKNOWN

        if status in (MatchStatus.MATCHED, MatchStatus.PARTIAL) and not verified:
            # Claimed evidence that is not in the CV: never let it raise the score.
            status = MatchStatus.PARTIAL if judgement.evidence_quotes else MatchStatus.NOT_FOUND
            method = "LLM_UNVERIFIED"
            manual = True
        elif unverified:
            manual = True

        years = judgement.relevant_years
        if requirement.min_years is not None and status == MatchStatus.MATCHED:
            # Re-check the year threshold in code instead of trusting the model's comparison.
            if years is None or years < requirement.min_years:
                status = MatchStatus.PARTIAL
                method = "LLM_YEARS_BELOW_MIN"

        return self._result(requirement, status, verified, unverified, judgement.reason, years, method, manual)

    @staticmethod
    def _result(requirement, status, verified, unverified, reason, years, method, manual) -> RequirementResult:
        return RequirementResult(
            requirement=requirement,
            type=requirement.type,
            matchStatus=status,
            evidence=verified,
            unverifiedEvidence=unverified,
            reason=reason,
            relevantYears=years,
            matchMethod=method,
            requiresManualReview=manual,
        )


def _parse_status(value: str) -> MatchStatus:
    try:
        return MatchStatus(value.strip().upper())
    except ValueError:
        return MatchStatus.UNKNOWN


__all__ = ["MatchingPipeline", "LlmCvAssessment"]
