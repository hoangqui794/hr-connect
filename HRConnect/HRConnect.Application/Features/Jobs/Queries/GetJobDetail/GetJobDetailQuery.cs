using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobDetail;
public sealed record GetJobDetailQuery(
    Guid JobId,
    Guid UserId,
    bool HasInternalAccess,
    IReadOnlyCollection<string> RoleCodes) : IRequest<JobDto>;
public sealed class GetJobDetailQueryHandler : IRequestHandler<GetJobDetailQuery, JobDto>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members;
    public GetJobDetailQueryHandler(IJobRepository jobs, ICompanyUserRepository members) => (_jobs, _members) = (jobs, members);
    public async Task<JobDto> Handle(GetJobDetailQuery request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct);
        var member = await _members.GetByUserIdAsync(request.UserId, ct);
        var isOwner = member?.CompanyId == job.CompanyId;
        var canViewByPolicy = JobAccessPolicy.CanViewDetail(
            job, isOwner, request.HasInternalAccess, request.RoleCodes);
        var canView = canViewByPolicy &&
                      (isOwner || request.HasInternalAccess ||
                       await _jobs.CanAnyRoleViewJobAsync(job.ServiceTypeId, request.RoleCodes, ct));
        if (!canView) throw new ForbiddenException("Bạn không có quyền xem công việc này.");

        return JobDto.From(job, includeStatusHistories: isOwner || request.HasInternalAccess);
    }
}
