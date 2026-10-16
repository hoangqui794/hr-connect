using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Reports.Queries.GetReportTopAffiliates;

public sealed record ReportTopAffiliatesResponse
{
    public List<TopAffiliateItemDto> Items { get; init; } = new();
}

public sealed record TopAffiliateItemDto
{
    public Guid AffiliateId { get; init; }
    public string FullName { get; init; } = string.Empty;
    public int TotalSubmissions { get; init; }
    public int TotalPlacements { get; init; }
    public decimal? SubmissionToHireRate { get; init; }
    public decimal? QualityRating { get; init; }
    public string RatingLabel { get; init; } = string.Empty;
    public decimal CommissionEarned { get; init; }
}
