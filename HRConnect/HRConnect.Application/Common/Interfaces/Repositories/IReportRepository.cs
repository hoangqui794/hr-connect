using System.Threading;
using System.Threading.Tasks;
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
}
