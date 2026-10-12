using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobsForReview;
public sealed record GetJobsForReviewQuery(string? Status = null) : IRequest<IReadOnlyList<JobDto>>;
public sealed class GetJobsForReviewQueryHandler : IRequestHandler<GetJobsForReviewQuery, IReadOnlyList<JobDto>>
{
    private readonly IJobRepository _jobs; public GetJobsForReviewQueryHandler(IJobRepository jobs) => _jobs = jobs;
    public async Task<IReadOnlyList<JobDto>> Handle(GetJobsForReviewQuery request, CancellationToken ct)
    {
        var status = string.IsNullOrWhiteSpace(request.Status) ? "PENDING_REVIEW" : request.Status;
        var list = await _jobs.GetForReviewAsync(status, ct);
        return list.Select(x => JobDto.From(x, includeStatusHistories: true)).ToList();
    }
}
