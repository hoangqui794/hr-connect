using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;

public class CandidateRecruitmentApplicationDetailResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy chi tiết hồ sơ tuyển dụng thành công.";

    public CandidateRecruitmentApplicationDetailDto Data { get; set; } = new();
}

public class CandidateRecruitmentApplicationDetailDto
{
    public Guid ApplicationId { get; set; }

    public Guid JobId { get; set; }

    public string JobTitle { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public Guid CandidateId { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? CurrentStage { get; set; }

    public string? StatusReason { get; set; }

    public DateTime AppliedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateOnly? PlannedStartDate { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public CandidateSubmittedCvDto? SubmittedCv { get; set; }

    public List<CandidateInterviewSummaryDto> Interviews { get; set; } = new();

    public List<CandidateOfferSummaryDto> Offers { get; set; } = new();

    public CandidatePlacementSummaryDto? Placement { get; set; }

    public List<string> AllowedActions { get; set; } = new();
}

public class CandidateSubmittedCvDto
{
    public Guid CvId { get; set; }

    public string? Title { get; set; }

    public string? FileName { get; set; }
}

public class CandidateInterviewSummaryDto
{
    public Guid InterviewId { get; set; }

    public int InterviewRound { get; set; }

    public string? InterviewType { get; set; }

    public DateTime? ScheduledAt { get; set; }

    public int? DurationMinutes { get; set; }

    public string? Location { get; set; }

    public string? MeetingLink { get; set; }

    public string Status { get; set; } = string.Empty;

    public Guid ConcurrencyToken { get; set; }
}

public class CandidateOfferSummaryDto
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

    public bool CanRespond { get; set; }
}

public class CandidatePlacementSummaryDto
{
    public Guid PlacementId { get; set; }

    public DateOnly ActualStartDate { get; set; }

    public string? Position { get; set; }

    public string? Department { get; set; }

    public string Status { get; set; } = string.Empty;
}
