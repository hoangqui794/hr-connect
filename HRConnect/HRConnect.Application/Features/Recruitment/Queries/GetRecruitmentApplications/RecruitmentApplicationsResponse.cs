using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplications;

public class RecruitmentApplicationsResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy danh sách hồ sơ tuyển dụng thành công.";

    public RecruitmentApplicationsData Data { get; set; } = new();
}

public class RecruitmentApplicationsData
{
    public List<RecruitmentApplicationItemDto> Items { get; set; } = new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int Total { get; set; }

    public int TotalPages { get; set; }
}

public class RecruitmentApplicationItemDto
{
    public Guid ApplicationId { get; set; }

    public Guid JobId { get; set; }

    public string JobTitle { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public Guid CandidateId { get; set; }

    public string CandidateName { get; set; } = string.Empty;

    public string? CandidateEmail { get; set; }

    public string? CandidatePhone { get; set; }

    public Guid? CvId { get; set; }

    public string? CvTitle { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? CurrentStage { get; set; }

    public DateTime AppliedAt { get; set; }

    public decimal? AiMatchScore { get; set; }

    public string? AiMatchTier { get; set; }

    public string? AiStatus { get; set; }

    public int? LatestInterviewRound { get; set; }

    public string? LatestInterviewStatus { get; set; }

    public string? LatestInterviewResult { get; set; }

    public DateTime? LatestInterviewScheduledAt { get; set; }

    public int TotalInterviews { get; set; }

    public string? LatestOfferStatus { get; set; }

    public decimal? LatestOfferSalary { get; set; }

    public DateOnly? PlannedStartDate { get; set; }

    public Guid ConcurrencyToken { get; set; }
}
