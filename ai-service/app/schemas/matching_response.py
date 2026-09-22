from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.matching_request import RequirementType


class RequirementMatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    requirement: str
    type: RequirementType
    matched: bool
    similarity: float = Field(ge=0, le=1)
    evidence: str | None = None
    match_method: Literal["DETERMINISTIC", "NOT_FOUND"] = Field(alias="matchMethod")


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
    model_name: str = Field(alias="modelName")
    status: Literal["COMPLETED"] = "COMPLETED"
