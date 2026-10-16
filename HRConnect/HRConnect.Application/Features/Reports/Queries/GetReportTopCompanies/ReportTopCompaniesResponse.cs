using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Reports.Queries.GetReportTopCompanies;

public sealed record ReportTopCompaniesResponse
{
    public List<TopCompanyItemDto> Items { get; init; } = new();
}

public sealed record TopCompanyItemDto
{
    public Guid CompanyId { get; init; }
    public string CompanyName { get; init; } = string.Empty;
    public string? Industry { get; init; }
    public int ActiveJobs { get; init; }
    public int Placements { get; init; }
    public decimal RevenueCollected { get; init; }
}
