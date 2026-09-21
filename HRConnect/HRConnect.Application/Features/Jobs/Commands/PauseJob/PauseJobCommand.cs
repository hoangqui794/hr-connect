using System.Text.Json.Serialization;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.PauseJob;
public sealed class PauseJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } public string? Reason { get; set; } }
public sealed class PauseJobCommandHandler : IRequestHandler<PauseJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members; private readonly IUnitOfWork _uow;
    public PauseJobCommandHandler(IJobRepository jobs, ICompanyUserRepository members, IUnitOfWork uow) => (_jobs, _members, _uow) = (jobs, members, uow);
    public async Task<JobActionResponse> Handle(PauseJobCommand request, CancellationToken ct)
    { var job = await JobHandlerGuards.GetOwnedJobAsync(_jobs, _members, request.JobId, request.UserId, ct); JobHandlerGuards.RequireStatus(job, JobStatuses.Active);
      JobTransitions.ChangeStatus(job, JobStatuses.Paused, request.UserId, request.Reason?.Trim()); await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct); await _uow.SaveChangesAsync(ct);
      return new(true, "Tạm dừng công việc thành công.", JobDto.From(job)); }
}
