using System;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.ExtendJobDeadline;

public sealed class ExtendJobDeadlineCommand : IRequest<JobActionResponse>
{
    [JsonIgnore]
    public Guid JobId { get; set; }

    [JsonIgnore]
    public Guid UserId { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public DateTime ApplicationDeadline { get; set; }
}

public sealed class ExtendJobDeadlineCommandValidator : AbstractValidator<ExtendJobDeadlineCommand>
{
    public ExtendJobDeadlineCommandValidator()
    {
        RuleFor(x => x.ApplicationDeadline)
            .NotEmpty()
            .WithMessage("Vui lòng chọn hạn nộp hồ sơ mới.");
    }
}

public sealed class ExtendJobDeadlineCommandHandler : IRequestHandler<ExtendJobDeadlineCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _members;
    private readonly IUnitOfWork _uow;
    private readonly IAuditLogService? _auditLogService;

    public ExtendJobDeadlineCommandHandler(
        IJobRepository jobs,
        ICompanyUserRepository members,
        IUnitOfWork uow,
        IAuditLogService? auditLogService = null)
    {
        _jobs = jobs;
        _members = members;
        _uow = uow;
        _auditLogService = auditLogService;
    }

    public async Task<JobActionResponse> Handle(ExtendJobDeadlineCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetOwnedJobAsync(_jobs, _members, request.JobId, request.UserId, ct);
        JobHandlerGuards.RequireStatus(job, JobStatuses.PendingAgreement, JobStatuses.PendingPayment);
        JobTransitions.RequireCurrentToken(job, request.ConcurrencyToken);

        var now = DateTime.UtcNow;
        var newDeadlineUtc = JobDates.ToUtc(request.ApplicationDeadline)!.Value;
        if (JobDates.IsApplicationDeadlineExpired(newDeadlineUtc, now))
        {
            throw new BadRequestException("Hạn nộp hồ sơ mới phải là ngày ở hiện tại hoặc tương lai.");
        }

        var oldDeadline = job.ApplicationDeadline;
        job.ApplicationDeadline = newDeadlineUtc;
        job.UpdatedAt = now;
        job.ConcurrencyToken = Guid.NewGuid();

        if (_auditLogService != null)
        {
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = "JOB_DEADLINE_EXTENDED",
                EntityType = "JOB",
                EntityId = job.JobId,
                ActorType = AuditActorTypes.User,
                ActorUserId = request.UserId,
                OldValues = new { applicationDeadline = oldDeadline },
                NewValues = new { applicationDeadline = newDeadlineUtc }
            }, ct);
        }

        await _uow.SaveChangesAsync(ct);
        return new(true, "Gia hạn hạn nộp hồ sơ thành công.", JobDto.From(job));
    }
}
