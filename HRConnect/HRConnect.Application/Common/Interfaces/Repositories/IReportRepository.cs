using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Features.Admin.Dashboard;
using HRConnect.Application.Features.Reports.Common;
using HRConnect.Application.Features.Reports.Queries.GetReportOverview;
using HRConnect.Application.Features.Reports.Queries.GetReportRevenue;
using HRConnect.Application.Features.Reports.Queries.GetReportTopAffiliates;
using HRConnect.Application.Features.Reports.Queries.GetReportTopCompanies;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IReportRepository
{
    Task<ReportOverviewResponse> GetOverviewAsync(ReportTimeRange range, CancellationToken cancellationToken = default);

    Task<ReportRevenueResponse> GetRevenueReportAsync(ReportTimeRange range, string groupBy, CancellationToken cancellationToken = default);

    Task<ReportTopAffiliatesResponse> GetTopAffiliatesAsync(ReportTimeRange range, string sortBy, int limit, AffiliateRatingConfig ratingConfig, CancellationToken cancellationToken = default);

    Task<ReportTopCompaniesResponse> GetTopCompaniesAsync(ReportTimeRange range, string sortBy, int limit, CancellationToken cancellationToken = default);

    /// <summary>VND cash in/out per Vietnam-time day, same conditions as the revenue report. Sparse (no empty days).</summary>
    Task<IReadOnlyList<DashboardCashflowDay>> GetDashboardCashflowByDayAsync(ReportTimeRange range, CancellationToken cancellationToken = default);

    /// <summary>New users, audit events and completed approvals per Vietnam-time day. Sparse (no empty days).</summary>
    Task<IReadOnlyList<DashboardActivityDay>> GetDashboardActivityByDayAsync(ReportTimeRange range, CancellationToken cancellationToken = default);

    /// <summary>Current KPIs; <paramref name="todayStartUtc"/> is 00:00 Vietnam time expressed in UTC.</summary>
    Task<DashboardKpiSnapshot> GetDashboardKpisAsync(DateTime todayStartUtc, CancellationToken cancellationToken = default);

    /// <summary>Distinct users per seeded role (all five returned, zero included).</summary>
    Task<IReadOnlyList<DashboardRoleCount>> GetDashboardUserRoleCountsAsync(CancellationToken cancellationToken = default);
}
