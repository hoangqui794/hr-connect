using System.Text.Json.Serialization;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.RejectJob;

public sealed class RejectJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } public Guid ConcurrencyToken { get; set; } public string ReasonCode { get; set; } = string.Empty; public string ReasonText { get; set; } = string.Empty; }
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
    private readonly IJobRepository _jobs;
    private readonly INotificationRepository _notifications;
    private readonly IUnitOfWork _uow;
    private readonly IServiceAgreementRepository? _agreements;
    private readonly IAuditLogService? _audit;
    private readonly IAppNotifier? _notifier;

    public RejectJobCommandHandler(
        IJobRepository jobs,
        INotificationRepository notifications,
        IUnitOfWork uow,
        IServiceAgreementRepository? agreements = null,
        IAuditLogService? audit = null,
        IAppNotifier? notifier = null)
        => (_jobs, _notifications, _uow, _agreements, _audit, _notifier) = (jobs, notifications, uow, agreements, audit, notifier);

    public async Task<JobActionResponse> Handle(RejectJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct);
        JobHandlerGuards.RequireStatus(job, JobStatuses.PendingReview, JobStatuses.PendingAgreement);
        JobTransitions.RequireCurrentToken(job, request.ConcurrencyToken);

        var reasonCode = request.ReasonCode.Trim().ToUpperInvariant();
        var reasonText = request.ReasonText.Trim();

        if (string.Equals(job.Status, JobStatuses.PendingAgreement, StringComparison.OrdinalIgnoreCase))
        {
            var currentAgreement = (job.CurrentServiceAgreement is { Status: not ServiceAgreementStatuses.Void } cur && cur.IsCurrent ? cur : null)
                ?? job.ServiceAgreements?.FirstOrDefault(a => a.IsCurrent && a.Status != ServiceAgreementStatuses.Void)
                ?? (_agreements != null ? await _agreements.GetCurrentByJobIdAsync(job.JobId, ct) : null);

            if (currentAgreement != null)
            {
                if (currentAgreement.Status == ServiceAgreementStatuses.Signed)
                {
                    throw new ConflictException(
                        "Không thể từ chối tin tuyển dụng khi thỏa thuận dịch vụ hiện tại đã được ký kết chính thức.",
                        "AGREEMENT_ALREADY_SIGNED");
                }

                var now = DateTime.UtcNow;
                var oldAgreementStatus = currentAgreement.Status;
                currentAgreement.Status = ServiceAgreementStatuses.Void;
                currentAgreement.IsCurrent = false;
                currentAgreement.VoidedAt = now;
                currentAgreement.VoidedByUserId = request.UserId;
                currentAgreement.VoidReason = reasonText;
                currentAgreement.ConcurrencyToken = Guid.NewGuid();
                if (job.CurrentServiceAgreementId == currentAgreement.ServiceAgreementId)
                {
                    job.CurrentServiceAgreementId = null;
                    job.CurrentServiceAgreement = null;
                }

                if (_audit != null)
                {
                    await _audit.AddAsync(new AuditEntry
                    {
                        Action = "SERVICE_AGREEMENT_VOIDED",
                        EntityType = "ServiceAgreement",
                        EntityId = currentAgreement.ServiceAgreementId,
                        ActorUserId = request.UserId,
                        OldValues = new { Status = oldAgreementStatus, IsCurrent = true },
                        NewValues = new
                        {
                            Status = currentAgreement.Status,
                            IsCurrent = currentAgreement.IsCurrent,
                            Reason = currentAgreement.VoidReason,
                            JobId = job.JobId
                        }
                    }, ct);
                }
            }
        }

        JobTransitions.ChangeStatus(job, JobStatuses.Rejected, request.UserId, reasonCode, reasonText);
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);

        if (_notifier != null)
        {
            await _notifier.NotifyCompanyAsync(job.CompanyId, new AppNotice(
                "JOB",
                "Tin tuyển dụng bị từ chối duyệt",
                $"Tin tuyển dụng \"{job.Title}\" đã bị từ chối: {reasonText}.",
                "JOB",
                job.JobId,
                $"/client/jobs?highlight={job.JobId}&openDetail=true"
            ), ct);

            await _notifier.NotifyRoleAsync("INTERNAL_HR", new AppNotice(
                "JOB",
                "Tin tuyển dụng đã bị từ chối",
                $"Tin tuyển dụng \"{job.Title}\" đã được từ chối duyệt: {reasonText}.",
                "JOB",
                job.JobId,
                $"/hr/jobs?status=CLOSED_REJECTED&highlight={job.JobId}"
            ), ct);
        }
        else
        {
            await _notifications.AddAsync(new HRConnect.Domain.Entities.Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = job.CreatedBy,
                NotificationType = "JOB",
                Title = "Tin tuyển dụng bị từ chối duyệt",
                Message = $"Tin tuyển dụng \"{job.Title}\" đã bị từ chối: {reasonText}.",
                RelatedEntityType = "JOB",
                RelatedEntityId = job.JobId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    jobId = job.JobId,
                    status = JobStatuses.Rejected,
                    reasonCode,
                    reasonText,
                    actionRoute = $"/client/jobs?highlight={job.JobId}&openDetail=true"
                }),
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }, ct);
        }

        await _uow.SaveChangesAsync(ct);
        return new(true, "Từ chối công việc thành công.", JobDto.From(job));
    }
}
