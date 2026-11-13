using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetMyJobs;
public sealed record GetMyJobsQuery(Guid UserId, string? Status) : IRequest<IReadOnlyList<JobDto>>;
public sealed class GetMyJobsQueryHandler : IRequestHandler<GetMyJobsQuery, IReadOnlyList<JobDto>>
{
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _members;
    private readonly ISourcingDeliveryRepository? _sourcingDeliveries;

    public GetMyJobsQueryHandler(
        IJobRepository jobs,
        ICompanyUserRepository members,
        ISourcingDeliveryRepository? sourcingDeliveries = null) =>
        (_jobs, _members, _sourcingDeliveries) = (jobs, members, sourcingDeliveries);

    public async Task<IReadOnlyList<JobDto>> Handle(GetMyJobsQuery request, CancellationToken ct)
    {
        var member = await _members.GetByUserIdAsync(request.UserId, ct) ?? throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
        var jobs = await _jobs.GetByCompanyIdAsync(member.CompanyId, ct);
        var filtered = jobs
            .Where(x => string.IsNullOrWhiteSpace(request.Status) || x.Status.Equals(request.Status, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var sourcingJobIds = filtered
            .Where(j => string.Equals(j.ServiceType?.Code, "CV_SOURCING", StringComparison.OrdinalIgnoreCase))
            .Select(j => j.JobId)
            .Distinct()
            .ToHashSet();

        var countedByJob = sourcingJobIds.Count == 0 || _sourcingDeliveries is null
            ? null
            : await _sourcingDeliveries.GetCountedCountsByJobIdsAsync(sourcingJobIds, ct);

        return filtered.Select(x =>
        {
            var dto = JobDto.From(x);
            return countedByJob is not null && sourcingJobIds.Contains(x.JobId)
                ? dto with { SourcingCounted = countedByJob.GetValueOrDefault(x.JobId, 0) }
                : dto;
        }).ToList();
    }
}
