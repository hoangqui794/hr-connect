using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissions;

public sealed record AffiliateSubmissionsResponse
{
    public IReadOnlyList<AffiliateSubmissionItemDto> Items { get; init; } = Array.Empty<AffiliateSubmissionItemDto>();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
}

public sealed record AffiliateSubmissionItemDto
{
    public Guid SubmissionId { get; init; }
    public Guid CandidateId { get; init; }
    public string CandidateName { get; init; } = string.Empty;
    public Guid JobId { get; init; }
    public string JobTitle { get; init; } = string.Empty;
    public Guid CvId { get; init; }
    public string Status { get; init; } = string.Empty;
    public Guid? ApplicationId { get; init; }
    public Guid? AttributionId { get; init; }
    public Guid? DuplicateOfSubmissionId { get; init; }
    public string? Reason { get; init; }
    public DateTime SubmittedAt { get; init; }
}
