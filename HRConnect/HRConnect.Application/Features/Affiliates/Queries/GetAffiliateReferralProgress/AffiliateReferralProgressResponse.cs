namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateReferralProgress;

/// <summary>Limited progress view for the affiliate that owns the referral.</summary>
public sealed record AffiliateReferralProgressResponse
{
    public IReadOnlyList<AffiliateReferralProgressItemDto> Items { get; init; } = Array.Empty<AffiliateReferralProgressItemDto>();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
}

/// <summary>Contains no schedule, feedback, offer, compensation, or other internal recruitment details.</summary>
public sealed record AffiliateReferralProgressItemDto
{
    public Guid SubmissionId { get; init; }
    public Guid? ApplicationId { get; init; }
    public string CandidateName { get; init; } = string.Empty;
    public string JobTitle { get; init; } = string.Empty;
    public string CompanyName { get; init; } = string.Empty;
    public string ProgressStatus { get; init; } = string.Empty;
    public DateTime UpdatedAt { get; init; }
}
