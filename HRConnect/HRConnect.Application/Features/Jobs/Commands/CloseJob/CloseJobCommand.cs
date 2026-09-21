using System.Text.Json.Serialization;
using FluentValidation;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.CloseJob;
public sealed class CloseJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } public string Reason { get; set; } = string.Empty; }
public sealed class CloseJobCommandValidator : AbstractValidator<CloseJobCommand> { public CloseJobCommandValidator() => RuleFor(x => x.Reason).NotEmpty().MaximumLength(2000); }
public sealed class CloseJobCommandHandler : IRequestHandler<CloseJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members; private readonly IUnitOfWork _uow;
    public CloseJobCommandHandler(IJobRepository jobs, ICompanyUserRepository members, IUnitOfWork uow) => (_jobs, _members, _uow) = (jobs, members, uow);
    public async Task<JobActionResponse> Handle(CloseJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetOwnedJobAsync(_jobs, _members, request.JobId, request.UserId, ct); JobHandlerGuards.RequireStatus(job, JobStatuses.Active, JobStatuses.Paused);
        JobTransitions.ChangeStatus(job, JobStatuses.Closed, request.UserId, request.Reason.Trim()); await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct); job.ClosedAt = DateTime.UtcNow;
        await _uow.SaveChangesAsync(ct); return new(true, "Đóng công việc thành công.", JobDto.From(job));
    }
}
