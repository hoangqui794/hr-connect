using System.Collections.Generic;

namespace HRConnect.Application.Features.Reports.Queries.GetReportRevenue;

public sealed record ReportRevenueResponse
{
    public string Currency { get; init; } = "VND";
    public Dictionary<string, RevenueServiceTotalDto> Totals { get; init; } = new();
    public List<RevenueSeriesItemDto> Series { get; init; } = new();
    public RevenueCommissionDto Commission { get; init; } = new();
}

public sealed record RevenueServiceTotalDto
{
    public decimal Billed { get; init; }
    public decimal Collected { get; init; }
}

public sealed record RevenueSeriesItemDto
{
    public string Period { get; init; } = string.Empty;
    public decimal HEADHUNT_COD { get; init; }
    public decimal CV_SOURCING { get; init; }
    public decimal CV_APPLICATION { get; init; }
}

public sealed record RevenueCommissionDto
{
    public decimal Earned { get; init; }
    public decimal Paid { get; init; }
}
