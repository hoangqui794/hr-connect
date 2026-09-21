using System.Text.Json.Serialization;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.ResumeJob;
public sealed class ResumeJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } }
public sealed class ResumeJobCommandHandler : IRequestHandler<ResumeJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members; private readonly IUnitOfWork _uow;
    public ResumeJobCommandHandler(IJobRepository jobs, ICompanyUserRepository members, IUnitOfWork uow) => (_jobs, _members, _uow) = (jobs, members, uow);
    public async Task<JobActionResponse> Handle(ResumeJobCommand request, CancellationToken ct)
    { var job = await JobHandlerGuards.GetOwnedJobAsync(_jobs, _members, request.JobId, request.UserId, ct); JobHandlerGuards.RequireStatus(job, JobStatuses.Paused);
      JobTransitions.ChangeStatus(job, JobStatuses.Active, request.UserId, "Resumed"); await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct); await _uow.SaveChangesAsync(ct);
      return new(true, "Tiếp tục công việc thành công.", JobDto.From(job)); }
}
