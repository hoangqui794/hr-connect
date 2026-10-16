using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Reports.Common;
using MediatR;

namespace HRConnect.Application.Features.Reports.Queries.GetReportTopCompanies;

public sealed class GetReportTopCompaniesQueryHandler : IRequestHandler<GetReportTopCompaniesQuery, ReportTopCompaniesResponse>
{
    private readonly IReportRepository _reportRepository;

    public GetReportTopCompaniesQueryHandler(IReportRepository reportRepository)
    {
        _reportRepository = reportRepository;
    }

    public async Task<ReportTopCompaniesResponse> Handle(GetReportTopCompaniesQuery request, CancellationToken cancellationToken)
    {
        var range = ReportTimeRange.Create(request.From, request.To);

        var sortBy = (request.SortBy ?? "PLACEMENTS").Trim().ToUpperInvariant();
        if (sortBy is not ("PLACEMENTS" or "REVENUE" or "ACTIVE_JOBS"))
        {
            throw new BadRequestException("Tham số sortBy chỉ chấp nhận các giá trị: PLACEMENTS, REVENUE, ACTIVE_JOBS.");
        }

        var limit = request.Limit switch
        {
            < 1 => 10,
            > 100 => 100,
            _ => request.Limit
        };

        return await _reportRepository.GetTopCompaniesAsync(range, sortBy, limit, cancellationToken);
    }
}
