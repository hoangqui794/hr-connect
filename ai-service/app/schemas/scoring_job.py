from typing import Literal

from pydantic import Field

from app.schemas.matching_request import StrictTextModel


class ScoringJobRequest(StrictTextModel):
    request_id: str = Field(alias="requestId", min_length=1, max_length=200)
    application_id: str = Field(alias="applicationId", min_length=1, max_length=200)
    cv_id: str = Field(alias="cvId", min_length=1, max_length=200)
    job_id: str = Field(alias="jobId", min_length=1, max_length=200)
    attempt_no: int = Field(alias="attemptNo", ge=1)


class ScoringJobAccepted(StrictTextModel):
    request_id: str = Field(alias="requestId")
    status: Literal["ACCEPTED"] = "ACCEPTED"
