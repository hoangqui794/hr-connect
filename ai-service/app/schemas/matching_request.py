from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RequirementType(str, Enum):
    MUST_HAVE = "MUST_HAVE"
    SHOULD_HAVE = "SHOULD_HAVE"


class RequirementCategory(str, Enum):
    SKILL = "SKILL"
    EXPERIENCE = "EXPERIENCE"
    EDUCATION = "EDUCATION"
    OTHER = "OTHER"


class RequirementOperator(str, Enum):
    """How multiple evidence terms inside one requirement are evaluated."""

    ANY_OF = "ANY_OF"
    ALL_OF = "ALL_OF"
    AT_LEAST = "AT_LEAST"


class StrictTextModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    @field_validator("*", mode="before")
    @classmethod
    def reject_blank_strings(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            raise ValueError("Text fields must not be empty")
        return value


class CandidateSkill(StrictTextModel):
    name: str = Field(min_length=1, max_length=200)
    years_of_experience: float | None = Field(default=None, alias="yearsOfExperience", ge=0)


class Candidate(StrictTextModel):
    summary: str = Field(min_length=1, max_length=5000)
    years_of_experience: float | None = Field(default=None, alias="yearsOfExperience", ge=0)
    highest_education: str | None = Field(default=None, alias="highestEducation", max_length=300)
    skills: list[CandidateSkill] = Field(default_factory=list, max_length=200)
    cv_text: str = Field(alias="cvText", min_length=1, max_length=100_000)
    parse_confidence: float = Field(default=1.0, alias="parseConfidence", ge=0, le=1)
    requires_manual_review: bool = Field(default=False, alias="requiresManualReview")
    parse_warnings: list[str] = Field(default_factory=list, alias="parseWarnings", max_length=100)
    unreliable_evidence_fields: list[str] = Field(
        default_factory=list, alias="unreliableEvidenceFields", max_length=20
    )


class JobRequirement(StrictTextModel):
    type: RequirementType
    category: RequirementCategory
    content: str = Field(min_length=1, max_length=2000)
    operator: RequirementOperator = RequirementOperator.ALL_OF
    alternatives: list[str] = Field(default_factory=list, max_length=20)
    min_years: float | None = Field(default=None, alias="minYears", ge=0, le=80)
    evidence_groups: list[list[str]] = Field(default_factory=list, alias="evidenceGroups", max_length=10)
    # MUST_HAVE only: when not fully MATCHED the score is capped (KNOCKOUT_SCORE_CAP).
    knockout: bool = False

    @field_validator("alternatives")
    @classmethod
    def reject_blank_alternatives(cls, values: list[str]) -> list[str]:
        if any(not value.strip() for value in values):
            raise ValueError("Requirement alternatives must not be empty")
        return values

    @field_validator("evidence_groups")
    @classmethod
    def reject_empty_evidence_groups(cls, groups: list[list[str]]) -> list[list[str]]:
        if any(not group or any(not value.strip() for value in group) for group in groups):
            raise ValueError("Evidence groups must contain non-empty terms")
        return groups


class Job(StrictTextModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1, max_length=50_000)
    requirements: list[JobRequirement] = Field(min_length=1, max_length=200)


class MatchingRequest(StrictTextModel):
    request_id: str = Field(alias="requestId", min_length=1, max_length=200)
    application_id: str = Field(alias="applicationId", min_length=1, max_length=200)
    attempt_no: int = Field(alias="attemptNo", ge=1)
    candidate: Candidate
    job: Job
