using System.Collections.Generic;

namespace HRConnect.Application.Features.Reports.Queries.GetReportOverview;

public sealed record ReportOverviewResponse
{
    public ReportOverviewJobs Jobs { get; init; } = new();
    public ReportOverviewApplications Applications { get; init; } = new();
    public ReportOverviewPlacements Placements { get; init; } = new();
    public ReportOverviewCompanies Companies { get; init; } = new();
    public ReportOverviewAffiliates Affiliates { get; init; } = new();
}

public sealed record ReportOverviewJobs
{
    public Dictionary<string, int> ByStatus { get; init; } = new();
    public Dictionary<string, int> ByServiceType { get; init; } = new();
}

public sealed record ReportOverviewApplications
{
    public int Submitted { get; init; }
    public int Shortlisted { get; init; }
    public int Interview { get; init; }
    public int Placed { get; init; }
}

public sealed record ReportOverviewPlacements
{
    public int Started { get; init; }
    public int WarrantyPassed { get; init; }
    public int WarrantyVoided { get; init; }
}

public sealed record ReportOverviewCompanies
{
    public int Verified { get; init; }
    public int Pending { get; init; }
}

public sealed record ReportOverviewAffiliates
{
    public int Active { get; init; }
    public int Pending { get; init; }
}
