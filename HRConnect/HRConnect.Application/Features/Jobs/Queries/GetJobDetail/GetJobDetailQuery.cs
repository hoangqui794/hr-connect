using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobDetail;
public sealed record GetJobDetailQuery(
    Guid JobId,
    Guid UserId,
    bool HasInternalAccess,
    IReadOnlyCollection<string> RoleCodes) : IRequest<JobDetailDto>;
public sealed class GetJobDetailQueryHandler : IRequestHandler<GetJobDetailQuery, JobDetailDto>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members;
    private readonly ICompanyLogoUrlResolver? _logoUrlResolver;
    private readonly ISourcingDeliveryRepository? _sourcingDeliveries;
    public GetJobDetailQueryHandler(
        IJobRepository jobs,
        ICompanyUserRepository members,
        ICompanyLogoUrlResolver? logoUrlResolver = null,
        ISourcingDeliveryRepository? sourcingDeliveries = null)
        => (_jobs, _members, _logoUrlResolver, _sourcingDeliveries) = (jobs, members, logoUrlResolver, sourcingDeliveries);
    public async Task<JobDetailDto> Handle(GetJobDetailQuery request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct);
        var member = await _members.GetByUserIdAsync(request.UserId, ct);
        var isOwner = member?.CompanyId == job.CompanyId;
        var canViewByPolicy = JobAccessPolicy.CanViewDetail(
            job, isOwner, request.HasInternalAccess);
        var canView = canViewByPolicy &&
                      (isOwner || request.HasInternalAccess ||
                       await _jobs.CanAnyRoleViewJobAsync(job.ServiceTypeId, request.RoleCodes, ct));
        if (!canView) throw new ForbiddenException("Bạn không có quyền xem công việc này.");

        var dto = JobDetailDto.From(job, includeStatusHistories: isOwner || request.HasInternalAccess,
            isReviewer: request.HasInternalAccess, logoUrlResolver: _logoUrlResolver);

        var canSeeSourcingProgress = isOwner || request.HasInternalAccess ||
            request.RoleCodes.Any(r => string.Equals(r, "AFFILIATE", StringComparison.OrdinalIgnoreCase));
        if (canSeeSourcingProgress &&
            _sourcingDeliveries is not null &&
            string.Equals(job.ServiceType?.Code, "CV_SOURCING", StringComparison.OrdinalIgnoreCase))
        {
            var counted = await _sourcingDeliveries.GetCountedCountsByJobIdsAsync([job.JobId], ct);
            return dto with { SourcingCounted = counted.GetValueOrDefault(job.JobId, 0) };
        }

        return dto;
    }
}
