from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RequirementType(str, Enum):
    MUST_HAVE = "MUST_HAVE"
    SHOULD_HAVE = "SHOULD_HAVE"


class MatchStatus(str, Enum):
    MATCHED = "MATCHED"
    PARTIAL = "PARTIAL"
    NOT_FOUND = "NOT_FOUND"
    UNKNOWN = "UNKNOWN"


class Requirement(BaseModel):
    """Same shape as the v1 job requirement, so the .NET backend sends one payload to either service."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str = ""
    """Optional: the HR Connect /internal/jobs/{id}/jd endpoint sends none, so Job assigns r1, r2, ..."""
    type: RequirementType
    category: str = "OTHER"
    content: str
    operator: str | None = None
    alternatives: list[str] = Field(default_factory=list)
    min_years: float | None = Field(default=None, alias="minYears")
    knockout: bool | None = None


class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    description: str = ""
    requirements: list[Requirement]

    @model_validator(mode="after")
    def _assign_missing_ids(self) -> "Job":
        used = {requirement.id for requirement in self.requirements if requirement.id}
        counter = 0
        for requirement in self.requirements:
            if requirement.id:
                continue
            counter += 1
            while f"r{counter}" in used:
                counter += 1
            requirement.id = f"r{counter}"
            used.add(requirement.id)
        return self


class MatchingMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    request_id: str = Field(alias="requestId")
    application_id: str = Field(alias="applicationId")
    attempt_no: int = Field(default=1, alias="attemptNo")
    job: Job


class RequirementResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    requirement: Requirement
    type: RequirementType
    match_status: MatchStatus = Field(alias="matchStatus")
    evidence: list[str] = Field(default_factory=list)
    unverified_evidence: list[str] = Field(default_factory=list, alias="unverifiedEvidence")
    reason: str = ""
    relevant_years: float | None = Field(default=None, alias="relevantYears")
    match_method: str = Field(alias="matchMethod")
    requires_manual_review: bool = Field(default=False, alias="requiresManualReview")


class OverallFit(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    level: int
    """1-5 as judged by the LLM, after code checks (levels 3-5 need a verified quote)."""
    score: float
    """Level mapped to 0..1 by code: (level - 1) / 4."""
    reason: str
    evidence: list[str] = Field(default_factory=list)
    unverified_evidence: list[str] = Field(default_factory=list, alias="unverifiedEvidence")
    adjusted: bool = False


class MatchingResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    request_id: str = Field(alias="requestId")
    application_id: str = Field(alias="applicationId")
    attempt_no: int = Field(alias="attemptNo")
    match_score: float = Field(alias="matchScore")
    semantic_score: float = Field(alias="semanticScore")
    overall_fit: OverallFit = Field(alias="overallFit")
    must_have_result: list[RequirementResult] = Field(alias="mustHaveResult")
    should_have_result: list[RequirementResult] = Field(alias="shouldHaveResult")
    candidate_summary: str = Field(alias="candidateSummary")
    requires_manual_review: bool = Field(alias="requiresManualReview")
    review_reasons: list[str] = Field(default_factory=list, alias="reviewReasons")
    model_name: str = Field(alias="modelName")
    status: str = "COMPLETED"


class ParseResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    extraction_method: str = Field(alias="extractionMethod")
    has_text_layer: bool = Field(alias="hasTextLayer")
    page_count: int | None = Field(default=None, alias="pageCount")


class FileMatchingResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    parse_result: ParseResult = Field(alias="parseResult")
    matching_result: MatchingResult = Field(alias="matchingResult")
