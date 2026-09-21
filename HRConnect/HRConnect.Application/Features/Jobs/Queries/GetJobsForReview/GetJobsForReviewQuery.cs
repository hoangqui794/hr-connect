using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobsForReview;
public sealed record GetJobsForReviewQuery : IRequest<IReadOnlyList<JobDto>>;
public sealed class GetJobsForReviewQueryHandler : IRequestHandler<GetJobsForReviewQuery, IReadOnlyList<JobDto>>
{
    private readonly IJobRepository _jobs; public GetJobsForReviewQueryHandler(IJobRepository jobs) => _jobs = jobs;
    public async Task<IReadOnlyList<JobDto>> Handle(GetJobsForReviewQuery request, CancellationToken ct) =>
        (await _jobs.GetPendingReviewAsync(ct)).Select(x => JobDto.From(x)).ToList();
}
