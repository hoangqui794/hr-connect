using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateAttributions;

public sealed record AffiliateAttributionsResponse
{
    public IReadOnlyList<AffiliateAttributionItemDto> Items { get; init; } = Array.Empty<AffiliateAttributionItemDto>();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
}

public sealed record AffiliateAttributionItemDto
{
    public Guid AttributionId { get; init; }
    public Guid ApplicationId { get; init; }
    public Guid CandidateId { get; init; }
    public string CandidateName { get; init; } = string.Empty;
    public Guid JobId { get; init; }
    public string JobTitle { get; init; } = string.Empty;
    public Guid CvId { get; init; }
    public string AttributionRule { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTime EstablishedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
