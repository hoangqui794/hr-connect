from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.matching_request import RequirementType


class RequirementMatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    requirement: str
    type: RequirementType
    matched: bool
    match_status: Literal["MATCHED", "PARTIAL", "NOT_FOUND", "UNKNOWN"] = Field(
        default="NOT_FOUND", alias="matchStatus"
    )
    evidence_coverage: float = Field(default=0.0, alias="evidenceCoverage", ge=0, le=1)
    similarity: float = Field(ge=0, le=1)
    evidence: str | None = None
    matched_terms: list[str] = Field(default_factory=list, alias="matchedTerms")
    missing_evidence: list[str] = Field(default_factory=list, alias="missingEvidence")
    criteria: list[dict] = Field(default_factory=list)
    requires_manual_review: bool = Field(default=False, alias="requiresManualReview")
    warnings: list[str] = Field(default_factory=list)
    suggested_evidence: list[dict] = Field(default_factory=list, alias="suggestedEvidence")
    match_method: Literal[
        "DETERMINISTIC", "DETERMINISTIC_PARTIAL", "NOT_FOUND", "UNKNOWN"
    ] = Field(alias="matchMethod")


class MatchingResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    request_id: str = Field(alias="requestId")
    application_id: str = Field(alias="applicationId")
    attempt_no: int = Field(alias="attemptNo")
    match_score: float = Field(alias="matchScore", ge=0, le=100)
    semantic_score: float = Field(alias="semanticScore", ge=0, le=1)
    must_have_result: list[RequirementMatch] = Field(alias="mustHaveResult")
    should_have_result: list[RequirementMatch] = Field(alias="shouldHaveResult")
    candidate_highlights: list[str] = Field(alias="candidateHighlights")
    missing_requirements: list[str] = Field(alias="missingRequirements")
    matching_reasons: list[str] = Field(alias="matchingReasons")
    requires_manual_review: bool = Field(default=False, alias="requiresManualReview")
    model_name: str = Field(alias="modelName")
    status: Literal["COMPLETED"] = "COMPLETED"
