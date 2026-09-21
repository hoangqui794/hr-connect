using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetPublicJobs;

public sealed record GetPublicJobsQuery(
    IReadOnlyCollection<string> RoleCodes,
    string? Search,
    string? Location,
    string? EmploymentType,
    int Page = 1,
    int PageSize = 20) : IRequest<JobPageDto>;

public sealed record JobPageDto(
    IReadOnlyList<JobDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

public sealed class GetPublicJobsQueryHandler : IRequestHandler<GetPublicJobsQuery, JobPageDto>
{
    private readonly IJobRepository _jobs;

    public GetPublicJobsQueryHandler(IJobRepository jobs) => _jobs = jobs;

    public async Task<JobPageDto> Handle(GetPublicJobsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var (items, totalCount) = await _jobs.GetVisibleJobsAsync(
            request.RoleCodes.Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            request.Search,
            request.Location,
            request.EmploymentType,
            page,
            pageSize,
            cancellationToken);

        return new JobPageDto(
            items.Select(job => JobDto.From(job)).ToList(),
            page,
            pageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)pageSize));
    }
}
