using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateSubmissionConsents;

public sealed record GetCandidateSubmissionConsentsQuery(
    Guid UserId,
    string? Status = null,
    int Page = 1,
    int PageSize = 20) : IRequest<CandidateSubmissionConsentsResponse>;

public sealed class CandidateSubmissionConsentsResponse
{
    public bool Success { get; init; } = true;
    public CandidateSubmissionConsentsData Data { get; init; } = new();
}

public sealed class CandidateSubmissionConsentsData
{
    public IReadOnlyList<CandidateSubmissionConsentItem> Items { get; init; } = [];
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int Total { get; init; }
    public int TotalPages { get; init; }
}

public sealed class CandidateSubmissionConsentItem
{
    public Guid SubmissionId { get; init; }
    public string ConsentStatus { get; init; } = string.Empty;
    public string SubmissionStatus { get; init; } = string.Empty;
    public Guid JobId { get; init; }
    public string JobTitle { get; init; } = string.Empty;
    public Guid CompanyId { get; init; }
    public string CompanyName { get; init; } = string.Empty;
    public Guid CvId { get; init; }
    public string CvTitle { get; init; } = string.Empty;
    public string? CvFileName { get; init; }
    public long? CvFileSizeBytes { get; init; }
    public Guid AffiliateUserId { get; init; }
    public string AffiliateDisplayName { get; init; } = string.Empty;
    public string? AffiliateEmail { get; init; }
    public string? AffiliatePhone { get; init; }
    public string? PitchText { get; init; }
    public string? CandidateConditionSummary { get; init; }
    public decimal? SalaryMin { get; init; }
    public decimal? SalaryMax { get; init; }
    public string CurrencyCode { get; init; } = "VND";
    public string SalaryCurrency { get; init; } = "VND";
    public bool SalaryNegotiable { get; init; }
    public bool IsSalaryNegotiable { get; init; }
    public string? JobLocation { get; init; }
    public string? WorkLocation { get; init; }
    public string? WorkMode { get; init; }
    public string? EmploymentType { get; init; }
    public decimal? MinExperienceYears { get; init; }
    public decimal? MaxExperienceYears { get; init; }
    public string? ExperienceRequirement { get; init; }
    public DateTime RequestedAt { get; init; }
    public DateTime ExpiresAt { get; init; }
    public DateTime? RespondedAt { get; init; }
    public bool IsActionable { get; init; }
    public long RemainingSeconds { get; init; }
}
