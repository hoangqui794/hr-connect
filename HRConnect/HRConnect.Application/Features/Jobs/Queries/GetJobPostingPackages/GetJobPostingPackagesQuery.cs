using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobPostingPackages;

public sealed record GetJobPostingPackagesQuery(bool ActiveOnly = true) : IRequest<IReadOnlyList<JobPostingPackageDto>>;

public sealed class GetJobPostingPackagesQueryHandler : IRequestHandler<GetJobPostingPackagesQuery, IReadOnlyList<JobPostingPackageDto>>
{
    private readonly IJobRepository _jobRepository;
    private readonly IBusinessSettings _businessSettings;

    public GetJobPostingPackagesQueryHandler(IJobRepository jobRepository, IBusinessSettings businessSettings)
    {
        _jobRepository = jobRepository;
        _businessSettings = businessSettings;
    }

    public async Task<IReadOnlyList<JobPostingPackageDto>> Handle(GetJobPostingPackagesQuery request, CancellationToken cancellationToken)
    {
        var packages = await _jobRepository.GetPostingPackagesAsync(request.ActiveOnly, cancellationToken);

        return packages.Select(p =>
        {
            var price = p.Code.ToUpper() == JobPostingPackageCodes.Standard
                ? _businessSettings.StandardPostingPackagePrice
                : p.Price;

            var duration = p.Code.ToUpper() == JobPostingPackageCodes.Standard
                ? _businessSettings.StandardPostingDurationDays
                : p.DurationDays;

            return new JobPostingPackageDto(
                p.PackageId,
                p.Code,
                p.Name,
                p.Description,
                price,
                duration,
                p.MaxApplications,
                p.IsActive);
        }).ToList();
    }
}
