using System.Text.Json.Serialization;
using FluentValidation;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.RejectJob;

public sealed class RejectJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } public string ReasonCode { get; set; } = string.Empty; public string ReasonText { get; set; } = string.Empty; }
public sealed class RejectJobCommandValidator : AbstractValidator<RejectJobCommand>
{
    public RejectJobCommandValidator()
    {
        RuleFor(x => x.ReasonCode).Must(code => JobReasonCodes.RejectionCodes.Contains(code.Trim().ToUpperInvariant())).WithMessage("ReasonCode không hợp lệ cho thao tác từ chối Job.");
        RuleFor(x => x.ReasonText).NotEmpty().MaximumLength(2000);
    }
}
public sealed class RejectJobCommandHandler : IRequestHandler<RejectJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs; private readonly IUnitOfWork _uow;
    public RejectJobCommandHandler(IJobRepository jobs, IUnitOfWork uow) => (_jobs, _uow) = (jobs, uow);
    public async Task<JobActionResponse> Handle(RejectJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct); JobHandlerGuards.RequireStatus(job, JobStatuses.PendingReview);
        JobTransitions.ChangeStatus(job, JobStatuses.Rejected, request.UserId, request.ReasonCode.Trim().ToUpperInvariant(), request.ReasonText.Trim());
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);
        await _uow.SaveChangesAsync(ct);
        return new(true, "Từ chối công việc thành công.", JobDto.From(job));
    }
}
