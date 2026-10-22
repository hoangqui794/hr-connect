using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public sealed record GetServiceAgreementQuery(Guid JobId, Guid? AgreementId = null) : IRequest<ServiceAgreementDto>;

public sealed class GetServiceAgreementQueryHandler : IRequestHandler<GetServiceAgreementQuery, ServiceAgreementDto>
{
    private readonly IServiceAgreementRepository _agreements;
    private readonly IJobRepository _jobs;

    public GetServiceAgreementQueryHandler(IServiceAgreementRepository agreements, IJobRepository jobs)
    {
        _agreements = agreements;
        _jobs = jobs;
    }

    public async Task<ServiceAgreementDto> Handle(GetServiceAgreementQuery request, CancellationToken ct)
    {
        if (request.AgreementId.HasValue)
        {
            var byId = await _agreements.GetByIdAsync(request.AgreementId.Value, ct);
            if (byId == null || byId.JobId != request.JobId)
                throw new NotFoundException("Không tìm thấy thỏa thuận dịch vụ yêu cầu.");
            return ServiceAgreementDto.FromEntity(byId);
        }

        var current = await _agreements.GetCurrentByJobIdAsync(request.JobId, ct);
        if (current == null)
        {
            // If no active/current agreement, check latest from history
            var history = await _agreements.GetHistoryByJobIdAsync(request.JobId, ct);
            if (history.Count == 0)
                throw new NotFoundException("Tin tuyển dụng này chưa có thỏa thuận dịch vụ nào.");
            return ServiceAgreementDto.FromEntity(history[0]);
        }

        return ServiceAgreementDto.FromEntity(current);
    }
}

public sealed record GetServiceAgreementHistoryQuery(Guid JobId) : IRequest<IReadOnlyList<ServiceAgreementDto>>;

public sealed class GetServiceAgreementHistoryQueryHandler : IRequestHandler<GetServiceAgreementHistoryQuery, IReadOnlyList<ServiceAgreementDto>>
{
    private readonly IServiceAgreementRepository _agreements;

    public GetServiceAgreementHistoryQueryHandler(IServiceAgreementRepository agreements)
    {
        _agreements = agreements;
    }

    public async Task<IReadOnlyList<ServiceAgreementDto>> Handle(GetServiceAgreementHistoryQuery request, CancellationToken ct)
    {
        var history = await _agreements.GetHistoryByJobIdAsync(request.JobId, ct);
        return history.Select(ServiceAgreementDto.FromEntity).ToList();
    }
}
