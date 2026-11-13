using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobsForReview;
public sealed record GetJobsForReviewQuery(string? Status = null) : IRequest<IReadOnlyList<JobDto>>;
public sealed class GetJobsForReviewQueryHandler : IRequestHandler<GetJobsForReviewQuery, IReadOnlyList<JobDto>>
{
    private readonly IJobRepository _jobs;
    private readonly ISourcingDeliveryRepository? _sourcingDeliveries;

    public GetJobsForReviewQueryHandler(IJobRepository jobs, ISourcingDeliveryRepository? sourcingDeliveries = null) =>
        (_jobs, _sourcingDeliveries) = (jobs, sourcingDeliveries);

    public async Task<IReadOnlyList<JobDto>> Handle(GetJobsForReviewQuery request, CancellationToken ct)
    {
        var status = string.IsNullOrWhiteSpace(request.Status) ? "PENDING_REVIEW" : request.Status;
        var list = await _jobs.GetForReviewAsync(status, ct);
        var visible = list
            .Where(x => !string.Equals(x.Status, JobStatuses.Draft, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var sourcingJobIds = visible
            .Where(j => string.Equals(j.ServiceType?.Code, "CV_SOURCING", StringComparison.OrdinalIgnoreCase))
            .Select(j => j.JobId)
            .Distinct()
            .ToHashSet();

        var countedByJob = sourcingJobIds.Count == 0 || _sourcingDeliveries is null
            ? null
            : await _sourcingDeliveries.GetCountedCountsByJobIdsAsync(sourcingJobIds, ct);

        return visible.Select(x =>
        {
            var dto = JobDto.From(x, includeStatusHistories: true, isReviewer: true);
            return countedByJob is not null && sourcingJobIds.Contains(x.JobId)
                ? dto with { SourcingCounted = countedByJob.GetValueOrDefault(x.JobId, 0) }
                : dto;
        }).ToList();
    }
}
