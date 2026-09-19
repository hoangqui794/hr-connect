using System.Text.Json.Serialization;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.ApproveJob;

public sealed class ApproveJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } }
public sealed class ApproveJobCommandHandler : IRequestHandler<ApproveJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs; private readonly IUnitOfWork _uow;
    public ApproveJobCommandHandler(IJobRepository jobs, IUnitOfWork uow) => (_jobs, _uow) = (jobs, uow);
    public async Task<JobActionResponse> Handle(ApproveJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct);
        JobHandlerGuards.RequireStatus(job, JobStatuses.PendingReview);
        JobTransitions.ChangeStatus(job, JobStatuses.Active, request.UserId, "Approved and published");
        job.PostedAt = DateTime.UtcNow; job.ClosedAt = null;
        _jobs.Update(job); await _uow.SaveChangesAsync(ct);
        return new(true, "Duyệt và công bố công việc thành công.", JobDto.From(job));
    }
}
