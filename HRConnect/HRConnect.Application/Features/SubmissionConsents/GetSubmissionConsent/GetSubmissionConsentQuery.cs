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
    public string Status { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public string CandidateName { get; set; } = null!;
    public string JobTitle { get; set; } = null!;
    public string CompanyName { get; set; } = null!;
    public string CvFileName { get; set; } = null!;
    public string? CvDownloadUrl { get; set; }
    public DateTime? CvUrlExpiresAt { get; set; }
}
