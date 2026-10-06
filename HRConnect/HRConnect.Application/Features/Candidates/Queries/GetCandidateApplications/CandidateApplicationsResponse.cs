using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateApplications;

public class CandidateApplicationsResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy lịch sử ứng tuyển của ứng viên thành công.";

    public CandidateApplicationsData Data { get; set; } = new();
}

public class CandidateApplicationsData
{
    public List<CandidateApplicationItemDto> Items { get; set; } = new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int Total { get; set; }

    public int TotalPages { get; set; }
}

public class CandidateApplicationItemDto
{
    public Guid ApplicationId { get; set; }

    public Guid JobId { get; set; }

    public string JobTitle { get; set; } = string.Empty;

    public string CompanyName { get; set; } = string.Empty;

    public Guid? CvId { get; set; }

    public string? CvTitle { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? AiStatus { get; set; }

    public DateTime AppliedAt { get; set; }
}
