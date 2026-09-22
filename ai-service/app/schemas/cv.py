from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.matching_request import Job, StrictTextModel
from app.schemas.matching_response import MatchingResponse


class EvidenceModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    evidence: str | None = None
    confidence: float = Field(default=0.5, ge=0, le=1)
    source_section: str | None = Field(default=None, alias="sourceSection")


class ParsedSkill(EvidenceModel):
    name: str
    years_of_experience: float | None = Field(default=None, alias="yearsOfExperience")


class WorkExperience(EvidenceModel):
    company: str | None = None
    position: str | None = None
    start_date: str | None = Field(default=None, alias="startDate")
    end_date: str | None = Field(default=None, alias="endDate")
    description: str | None = None


class Education(EvidenceModel):
    school: str | None = None
    degree: str | None = None
    major: str | None = None
    start_date: str | None = Field(default=None, alias="startDate")
    end_date: str | None = Field(default=None, alias="endDate")


class Certification(EvidenceModel):
    name: str
    issuer: str | None = None
    issued_date: str | None = Field(default=None, alias="issuedDate")


class LanguageSkill(EvidenceModel):
    name: str
    level: str | None = None


class StructuredCandidate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str | None = Field(default=None, alias="fullName")
    email: str | None = None
    phone: str | None = None
    summary: str | None = None
    total_years_of_experience: float | None = Field(
        default=None, alias="totalYearsOfExperience"
    )
    skills: list[ParsedSkill] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
    work_experience: list[WorkExperience] = Field(default_factory=list, alias="workExperience")
    languages: list[LanguageSkill] = Field(default_factory=list)


ExtractionMethod = Literal[
    "PDF_TEXT",
    "PDF_OCR",
    "PDF_TEXT_WITH_OCR",
    "DOCX_TEXT",
    "IMAGE_OCR",
]


class DocumentMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    file_name: str = Field(alias="fileName")
    media_type: str = Field(alias="mediaType")
    file_size_bytes: int = Field(alias="fileSizeBytes")
    page_count: int | None = Field(default=None, alias="pageCount")
    extraction_method: ExtractionMethod = Field(alias="extractionMethod")
    ocr_applied: bool = Field(alias="ocrApplied")
    layout: Literal["SINGLE_COLUMN", "MULTI_COLUMN", "FLOW", "UNSTRUCTURED"] = "UNSTRUCTURED"


class CvParseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["COMPLETED"] = "COMPLETED"
    document: DocumentMetadata
    raw_text: str = Field(alias="rawText")
    candidate: StructuredCandidate
    parse_confidence: float = Field(alias="parseConfidence", ge=0, le=1)
    requires_manual_review: bool = Field(alias="requiresManualReview")
    warnings: list[str] = Field(default_factory=list)


class FileMatchingMetadata(StrictTextModel):
    request_id: str = Field(alias="requestId", min_length=1, max_length=200)
    application_id: str = Field(alias="applicationId", min_length=1, max_length=200)
    attempt_no: int = Field(alias="attemptNo", ge=1)
    job: Job


class FileMatchingResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    parse_result: CvParseResponse = Field(alias="parseResult")
    matching_result: MatchingResponse = Field(alias="matchingResult")
