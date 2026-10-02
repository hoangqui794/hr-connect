using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;

public class RecruitmentApplicationDetailResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy chi tiết hồ sơ tuyển dụng thành công.";

    public RecruitmentApplicationDetailData Data { get; set; } = new();
}

public class RecruitmentApplicationDetailData
{
    public Guid ApplicationId { get; set; }

    public Guid JobId { get; set; }

    public string JobTitle { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public Guid CandidateId { get; set; }

    public string CandidateFullName { get; set; } = string.Empty;

    public string? CandidateEmail { get; set; }

    public string? CandidatePhone { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public string? Gender { get; set; }

    public string? CurrentAddress { get; set; }

    public decimal? YearsOfExperience { get; set; }

    public string? HighestEducation { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? CurrentStage { get; set; }

    public string? StatusReason { get; set; }

    public DateTime AppliedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateOnly? PlannedStartDate { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public RecruitmentCvSummaryDto? Cv { get; set; }

    public RecruitmentAiMatchSummaryDto? AiMatch { get; set; }

    public List<RecruitmentInterviewSummaryDto> Interviews { get; set; } = new();

    public List<RecruitmentOfferSummaryDto> Offers { get; set; } = new();

    public RecruitmentPlacementSummaryDto? Placement { get; set; }

    public List<string> AllowedActions { get; set; } = new();
}

public class RecruitmentCvSummaryDto
{
    public Guid CvId { get; set; }

    public string? Title { get; set; }

    public string? FileName { get; set; }

    public string? FileUrl { get; set; }

    public long? FileSizeBytes { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class RecruitmentAiMatchSummaryDto
{
    public decimal? MatchScore { get; set; }

    public string? MatchTier { get; set; }

    public string? CandidateHighlight { get; set; }

    public string? Status { get; set; }
}

public class RecruitmentInterviewSummaryDto
{
    public Guid InterviewId { get; set; }

    public int InterviewRound { get; set; }

    public string? InterviewType { get; set; }

    public DateTime? ScheduledAt { get; set; }

    public int? DurationMinutes { get; set; }

    public string? Location { get; set; }

    public string? MeetingLink { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? Result { get; set; }

    public string? Feedback { get; set; }

    public Guid? RecordedBy { get; set; }

    public DateTime? RecordedAt { get; set; }

    public Guid ConcurrencyToken { get; set; }
}

public class RecruitmentOfferSummaryDto
{
    public Guid OfferId { get; set; }

    public int OfferVersion { get; set; }

    public decimal? Salary { get; set; }

    public string CurrencyCode { get; set; } = "VND";

    public DateOnly? StartDate { get; set; }

    public DateOnly? ExpiryDate { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? OfferDocumentUrl { get; set; }

    public DateTime? SentAt { get; set; }

    public DateTime? RespondedAt { get; set; }

    public string? DeclineReason { get; set; }

    public Guid ConcurrencyToken { get; set; }
}

public class RecruitmentPlacementSummaryDto
{
    public Guid PlacementId { get; set; }

    public DateOnly ActualStartDate { get; set; }

    public string? Position { get; set; }

    public string? Department { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime ConfirmedAt { get; set; }

    public string? ConfirmationNote { get; set; }
}
