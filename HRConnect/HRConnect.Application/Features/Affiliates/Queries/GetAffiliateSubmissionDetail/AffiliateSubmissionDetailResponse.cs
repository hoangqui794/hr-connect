using System;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissionDetail;

public sealed record AffiliateSubmissionDetailResponse
{
    public Guid SubmissionId { get; init; }
    public string Status { get; init; } = string.Empty;
    public Guid CandidateId { get; init; }
    public string CandidateName { get; init; } = string.Empty;
    public string? CandidateEmail { get; init; }
    public string? CandidatePhone { get; init; }
    public Guid JobId { get; init; }
    public string JobTitle { get; init; } = string.Empty;
    public string CompanyName { get; init; } = string.Empty;
    public Guid CvId { get; init; }
    public string? CvTitle { get; init; }
    public string? CvFileName { get; init; }
    public string? Reason { get; init; }
    public Guid? DuplicateOfSubmissionId { get; init; }
    public Guid? ApplicationId { get; init; }
    public Guid? AttributionId { get; init; }
    public DateTime SubmittedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
