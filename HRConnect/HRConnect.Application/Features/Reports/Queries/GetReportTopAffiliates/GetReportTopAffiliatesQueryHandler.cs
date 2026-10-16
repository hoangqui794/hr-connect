using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Reports.Common;
using MediatR;

namespace HRConnect.Application.Features.Reports.Queries.GetReportTopAffiliates;

public sealed class GetReportTopAffiliatesQueryHandler : IRequestHandler<GetReportTopAffiliatesQuery, ReportTopAffiliatesResponse>
{
    private readonly IReportRepository _reportRepository;
    private readonly IAdminBusinessSettings _settings;

    public GetReportTopAffiliatesQueryHandler(IReportRepository reportRepository, IAdminBusinessSettings settings)
    {
        _reportRepository = reportRepository;
        _settings = settings;
    }

    public async Task<ReportTopAffiliatesResponse> Handle(GetReportTopAffiliatesQuery request, CancellationToken cancellationToken)
    {
        var range = ReportTimeRange.Create(request.From, request.To);

        var sortBy = (request.SortBy ?? "PLACEMENTS").Trim().ToUpperInvariant();
        if (sortBy is not ("PLACEMENTS" or "SUBMISSION_TO_HIRE_RATE" or "COMMISSION_EARNED"))
        {
            throw new BadRequestException("Tham số sortBy chỉ chấp nhận các giá trị: PLACEMENTS, SUBMISSION_TO_HIRE_RATE, COMMISSION_EARNED.");
        }

        var limit = request.Limit switch
        {
            < 1 => 10,
            > 100 => 100,
            _ => request.Limit
        };

        var config = await AffiliateRatingConfig.LoadAsync(_settings, cancellationToken);

        return await _reportRepository.GetTopAffiliatesAsync(range, sortBy, limit, config, cancellationToken);
    }
}
