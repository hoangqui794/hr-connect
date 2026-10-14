using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobPostingPackages;

public sealed record GetJobPostingPackagesQuery(bool ActiveOnly = true) : IRequest<IReadOnlyList<JobPostingPackageDto>>;

public sealed class GetJobPostingPackagesQueryHandler : IRequestHandler<GetJobPostingPackagesQuery, IReadOnlyList<JobPostingPackageDto>>
{
    private readonly IJobRepository _jobRepository;

    public GetJobPostingPackagesQueryHandler(IJobRepository jobRepository)
    {
        _jobRepository = jobRepository;
    }

    public async Task<IReadOnlyList<JobPostingPackageDto>> Handle(GetJobPostingPackagesQuery request, CancellationToken cancellationToken)
    {
        var packages = await _jobRepository.GetPostingPackagesAsync(request.ActiveOnly, cancellationToken);

        return packages.Select(p => new JobPostingPackageDto(
            p.PackageId,
            p.Code,
            p.Name,
            p.Description,
            p.Price,
            p.DurationDays,
            p.MaxApplications,
            p.IsActive)).ToList();
    }
}
