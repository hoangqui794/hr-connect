using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Reports.Common;
using MediatR;

namespace HRConnect.Application.Features.Reports.Queries.GetReportRevenue;

public sealed class GetReportRevenueQueryHandler : IRequestHandler<GetReportRevenueQuery, ReportRevenueResponse>
{
    private readonly IReportRepository _reportRepository;

    public GetReportRevenueQueryHandler(IReportRepository reportRepository)
    {
        _reportRepository = reportRepository;
    }

    public async Task<ReportRevenueResponse> Handle(GetReportRevenueQuery request, CancellationToken cancellationToken)
    {
        var range = ReportTimeRange.Create(request.From, request.To);

        var groupBy = (request.GroupBy ?? "MONTH").Trim().ToUpperInvariant();
        if (groupBy is not ("MONTH" or "QUARTER" or "YEAR"))
        {
            throw new BadRequestException("Tham số groupBy chỉ chấp nhận các giá trị: MONTH, QUARTER, YEAR.");
        }

        return await _reportRepository.GetRevenueReportAsync(range, groupBy, cancellationToken);
    }
}
