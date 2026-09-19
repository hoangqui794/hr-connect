using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetMyJobs;
public sealed record GetMyJobsQuery(Guid UserId, string? Status) : IRequest<IReadOnlyList<JobDto>>;
public sealed class GetMyJobsQueryHandler : IRequestHandler<GetMyJobsQuery, IReadOnlyList<JobDto>>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members;
    public GetMyJobsQueryHandler(IJobRepository jobs, ICompanyUserRepository members) => (_jobs, _members) = (jobs, members);
    public async Task<IReadOnlyList<JobDto>> Handle(GetMyJobsQuery request, CancellationToken ct)
    {
        var member = await _members.GetByUserIdAsync(request.UserId, ct) ?? throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
        var jobs = await _jobs.GetByCompanyIdAsync(member.CompanyId, ct);
        return jobs.Where(x => string.IsNullOrWhiteSpace(request.Status) || x.Status.Equals(request.Status, StringComparison.OrdinalIgnoreCase)).Select(JobDto.From).ToList();
    }
}
