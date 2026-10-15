using System;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateApplicationDetail;

public sealed record CandidateApplicationDetailResponse
{
    public Guid ApplicationId { get; init; }
    public Guid CandidateId { get; init; }
    public Guid JobId { get; init; }
    public string JobTitle { get; init; } = string.Empty;
    public Guid? CompanyId { get; init; }
    public string CompanyName { get; init; } = string.Empty;
    public Guid? CvId { get; init; }
    public string? CvTitle { get; init; }
    public string? CvFileName { get; init; }
    public string DisplayGroup { get; init; } = string.Empty;
    public string DisplayLabel { get; init; } = string.Empty;
    public string? SubmissionSource { get; init; }
    public DateTime AppliedAt { get; init; }
    public DateTime UpdatedAt { get; init; }

    // AI screening summary if available
    public string? AiStatus { get; init; }
    public decimal? AiMatchScore { get; init; }
    public string? AiMatchTier { get; init; }
}
