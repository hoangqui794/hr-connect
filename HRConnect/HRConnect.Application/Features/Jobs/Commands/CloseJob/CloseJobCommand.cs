using System;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.CloseJob;

public sealed class CloseJobCommand : IRequest<JobActionResponse>
{
    [JsonIgnore]
    public Guid JobId { get; set; }

    [JsonIgnore]
    public Guid UserId { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public string ReasonCode { get; set; } = string.Empty;

    public string ReasonText { get; set; } = string.Empty;
}

public sealed class CloseJobCommandValidator : AbstractValidator<CloseJobCommand>
{
    public CloseJobCommandValidator()
    {
        RuleFor(x => x.ReasonCode)
            .Must(code => JobReasonCodes.CloseCodes.Contains(code.Trim().ToUpperInvariant()))
            .WithMessage("ReasonCode không hợp lệ cho thao tác đóng Job.");

        RuleFor(x => x.ReasonText)
            .NotEmpty()
            .MaximumLength(2000);
    }
}

public sealed class CloseJobCommandHandler : IRequestHandler<CloseJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _members;
    private readonly IUnitOfWork _uow;
    private readonly IFinanceRepository? _financeRepository;
    private readonly IAuditLogService? _auditLogService;
    private readonly IServiceAgreementRepository? _agreements;
    private readonly IAppNotifier? _notifier;

    public CloseJobCommandHandler(
        IJobRepository jobs,
        ICompanyUserRepository members,
        IUnitOfWork uow,
        IFinanceRepository? financeRepository = null,
        IAuditLogService? auditLogService = null,
        IServiceAgreementRepository? agreements = null,
        IAppNotifier? notifier = null)
    {
        _jobs = jobs;
        _members = members;
        _uow = uow;
        _financeRepository = financeRepository;
        _auditLogService = auditLogService;
        _agreements = agreements;
        _notifier = notifier;
    }

    public async Task<JobActionResponse> Handle(CloseJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetOwnedJobAsync(_jobs, _members, request.JobId, request.UserId, ct);
        JobHandlerGuards.RequireStatus(job, JobStatuses.Active, JobStatuses.Paused, JobStatuses.PendingPayment, JobStatuses.PendingAgreement);
        JobTransitions.RequireCurrentToken(job, request.ConcurrencyToken);

        var wasPendingPayment = string.Equals(job.Status, JobStatuses.PendingPayment, StringComparison.OrdinalIgnoreCase);
        var wasPendingAgreement = string.Equals(job.Status, JobStatuses.PendingAgreement, StringComparison.OrdinalIgnoreCase);
        var oldStatus = job.Status;
        var now = DateTime.UtcNow;

        if (wasPendingAgreement)
        {
            if (_agreements != null)
            {
                var currentAgreement = await _agreements.GetCurrentByJobIdAsync(job.JobId, ct);
                if (currentAgreement != null &&
                    !string.Equals(currentAgreement.Status, ServiceAgreementStatuses.Signed, StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(currentAgreement.Status, ServiceAgreementStatuses.Void, StringComparison.OrdinalIgnoreCase))
                {
                    currentAgreement.Status = ServiceAgreementStatuses.Void;
                    currentAgreement.IsCurrent = false;
                    currentAgreement.VoidedAt = now;
                    currentAgreement.VoidedByUserId = request.UserId;
                    currentAgreement.VoidReason = $"Doanh nghiệp đóng tin trước khi ký thỏa thuận: {request.ReasonText.Trim()}";
                    currentAgreement.ConcurrencyToken = Guid.NewGuid();
                }
            }

            job.CurrentServiceAgreementId = null;

            if (_notifier != null)
            {
                await _notifier.NotifyRoleAsync("INTERNAL_HR", new AppNotice(
                    "JOB",
                    "Doanh nghiệp đã đóng tin chờ ký thỏa thuận",
                    $"Doanh nghiệp đã đóng tin \"{job.Title}\" khi chưa ký thỏa thuận dịch vụ. Dự thảo thỏa thuận đã được tự động hủy.",
                    "JOB",
                    job.JobId,
                    $"/hr/jobs?highlight={job.JobId}"
                ), ct);
            }
        }

        if (wasPendingPayment)
        {
            var postingFee = await _jobs.GetPostingFeeByJobIdAsync(job.JobId, ct);
            if (postingFee != null && string.Equals(postingFee.Status, JobPostingFeeStatuses.Pending, StringComparison.OrdinalIgnoreCase))
            {
                postingFee.Status = JobPostingFeeStatuses.Cancelled;
                postingFee.UpdatedAt = now;
            }

            if (_financeRepository != null)
            {
                var serviceFees = await _financeRepository.GetJobServiceFeesForUpdateAsync(job.JobId, ct);
                if (serviceFees != null)
                {
                    foreach (var fee in serviceFees)
                    {
                        if (string.Equals(fee.Kind, ServiceFeeKinds.Deposit, StringComparison.OrdinalIgnoreCase) &&
                            fee.Status is ServiceFeeStates.Pending or ServiceFeeStates.Due or ServiceFeeStates.Overdue)
                        {
                            fee.Status = ServiceFeeStates.Cancelled;
                            fee.UpdatedAt = now;
                        }
                    }
                }
            }
        }

        JobTransitions.ChangeStatus(job, JobStatuses.Closed, request.UserId, request.ReasonCode.Trim().ToUpperInvariant(), request.ReasonText.Trim());
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);
        job.ClosedAt = now;

        if (_auditLogService != null)
        {
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.JobClosed,
                EntityType = "JOB",
                EntityId = job.JobId,
                ActorType = AuditActorTypes.User,
                ActorUserId = request.UserId,
                OldValues = new { status = oldStatus },
                NewValues = new { status = JobStatuses.Closed, reasonCode = request.ReasonCode, reasonText = request.ReasonText }
            }, ct);
        }

        await _uow.SaveChangesAsync(ct);
        return new(true, "Đóng công việc thành công.", JobDto.From(job));
    }
}

