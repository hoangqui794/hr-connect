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


class JobRequirement(StrictTextModel):
    type: RequirementType
    category: RequirementCategory
    content: str = Field(min_length=1, max_length=2000)


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
