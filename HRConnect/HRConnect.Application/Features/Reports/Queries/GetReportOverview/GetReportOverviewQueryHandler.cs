using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Reports.Common;
using MediatR;

namespace HRConnect.Application.Features.Reports.Queries.GetReportOverview;

public sealed class GetReportOverviewQueryHandler : IRequestHandler<GetReportOverviewQuery, ReportOverviewResponse>
{
    private readonly IReportRepository _reportRepository;

    public GetReportOverviewQueryHandler(IReportRepository reportRepository)
    {
        _reportRepository = reportRepository;
    }

    public async Task<ReportOverviewResponse> Handle(GetReportOverviewQuery request, CancellationToken cancellationToken)
    {
        var range = ReportTimeRange.Create(request.From, request.To);
        return await _reportRepository.GetOverviewAsync(range, cancellationToken);
    }
}
