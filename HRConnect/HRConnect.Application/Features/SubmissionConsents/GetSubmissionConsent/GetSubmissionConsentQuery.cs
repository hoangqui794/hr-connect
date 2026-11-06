using MediatR;

namespace HRConnect.Application.Features.SubmissionConsents.GetSubmissionConsent;

public sealed record GetSubmissionConsentQuery(
    string? Token,
    Guid? SubmissionId,
    Guid? RequesterUserId) : IRequest<SubmissionConsentReviewResponse>;

public sealed class SubmissionConsentReviewResponse
{
    public bool Success { get; set; } = true;
    public SubmissionConsentReviewData Data { get; set; } = null!;
}

public sealed class SubmissionConsentReviewData
{
    public Guid SubmissionId { get; set; }
    public Guid JobId { get; set; }
    public Guid CompanyId { get; set; }
    public string? CompanyLogoUrl { get; set; }
    public string Status { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public string CandidateName { get; set; } = null!;
    public string JobTitle { get; set; } = null!;
    public string CompanyName { get; set; } = null!;
    public string? JobLocation { get; set; }
    public string? WorkLocation { get; set; }
    public string? WorkMode { get; set; }
    public string? EmploymentType { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string CurrencyCode { get; set; } = "VND";
    public string SalaryCurrency { get; set; } = "VND";
    public bool SalaryNegotiable { get; set; }
    public bool IsSalaryNegotiable { get; set; }
    public decimal? MinExperienceYears { get; set; }
    public decimal? MaxExperienceYears { get; set; }
    public string? ExperienceRequirement { get; set; }
    public string? AffiliateDisplayName { get; set; }
    public string? AffiliateEmail { get; set; }
    public string? AffiliatePhone { get; set; }
    public string? PitchText { get; set; }
    public string? CandidateConditionSummary { get; set; }
    public string CvFileName { get; set; } = null!;
    public long? CvFileSizeBytes { get; set; }
    public string? CvDownloadUrl { get; set; }
    public DateTime? CvUrlExpiresAt { get; set; }
    public string? AffiliateReuseStatus { get; set; }
    public Guid? ReuseConcurrencyToken { get; set; }
}
