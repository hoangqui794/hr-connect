using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetPublicJobs;

public sealed record GetPublicJobsQuery(
    IReadOnlyCollection<string> RoleCodes,
    bool HasInternalAccess,
    string? Search,
    string? Location,
    string? EmploymentType,
    Guid? ServiceTypeId = null,
    decimal? SalaryMin = null,
    decimal? SalaryMax = null,
    int Page = 1,
    int PageSize = 20,
    string? SortBy = null,
    string? SortDirection = null) : IRequest<JobPageDto>;

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
        if (!string.IsNullOrWhiteSpace(request.EmploymentType) && !EmploymentTypes.All.Contains(request.EmploymentType.Trim().ToUpperInvariant()))
            throw new HRConnect.Application.Common.Exceptions.BadRequestException("EmploymentType phải là FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP hoặc FREELANCE.");
        if (request.SalaryMin < 0 || request.SalaryMax < 0 || (request.SalaryMin.HasValue && request.SalaryMax.HasValue && request.SalaryMin > request.SalaryMax))
            throw new HRConnect.Application.Common.Exceptions.BadRequestException("Khoảng lương filter không hợp lệ.");

        string? sortBy = null;
        if (!string.IsNullOrWhiteSpace(request.SortBy))
        {
            var normalizedSortBy = request.SortBy.Trim().ToUpperInvariant();
            if (normalizedSortBy is not "POSTED_AT" and not "SALARY")
                throw new HRConnect.Application.Common.Exceptions.BadRequestException("sortBy chỉ chấp nhận POSTED_AT hoặc SALARY.");
            sortBy = normalizedSortBy;
        }

        string? sortDirection = null;
        if (!string.IsNullOrWhiteSpace(request.SortDirection))
        {
            var normalizedSortDirection = request.SortDirection.Trim().ToUpperInvariant();
            if (normalizedSortDirection is not "DESC" and not "ASC")
                throw new HRConnect.Application.Common.Exceptions.BadRequestException("sortDirection chỉ chấp nhận DESC hoặc ASC.");
            sortDirection = normalizedSortDirection;
        }

        var roleCodes = request.RoleCodes.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var (items, totalCount) = await _jobs.GetVisibleJobsAsync(
            roleCodes,
            request.HasInternalAccess,
            request.Search,
            request.Location,
            request.EmploymentType,
            request.ServiceTypeId,
            request.SalaryMin,
            request.SalaryMax,
            page,
            pageSize,
            sortBy,
            sortDirection,
            cancellationToken);

        return new JobPageDto(
            items.Select(job => JobDto.From(job)).ToList(),
            page,
            pageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)pageSize));
    }
}
