using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobDetail;
public sealed record GetJobDetailQuery(Guid JobId, Guid UserId, bool CanReview) : IRequest<JobDto>;
public sealed class GetJobDetailQueryHandler : IRequestHandler<GetJobDetailQuery, JobDto>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members;
    public GetJobDetailQueryHandler(IJobRepository jobs, ICompanyUserRepository members) => (_jobs, _members) = (jobs, members);
    public async Task<JobDto> Handle(GetJobDetailQuery request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct);
        if (!request.CanReview)
        {
            var member = await _members.GetByUserIdAsync(request.UserId, ct);
            if (member == null || member.CompanyId != job.CompanyId) throw new ForbiddenException("Bạn không có quyền xem công việc này.");
        }
        return JobDto.From(job);
    }
}
