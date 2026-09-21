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
        if (request.HasInternalAccess)
        {
            return JobDto.From(job, includeStatusHistories: true);
        }

        var member = await _members.GetByUserIdAsync(request.UserId, ct);
        if (member?.CompanyId == job.CompanyId)
        {
            return JobDto.From(job, includeStatusHistories: true);
        }

        var canView = job.Status == JobStatuses.Active && job.Visibility == JobVisibilities.Public &&
                      await _jobs.CanAnyRoleViewJobAsync(job.ServiceTypeId, request.RoleCodes, ct);
        if (!canView) throw new ForbiddenException("Bạn không có quyền xem công việc này.");

        return JobDto.From(job);
    }
}
