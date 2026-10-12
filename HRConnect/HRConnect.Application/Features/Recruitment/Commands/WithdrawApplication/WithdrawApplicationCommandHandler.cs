using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.WithdrawApplication;

public class WithdrawApplicationCommandHandler : IRequestHandler<WithdrawApplicationCommand, WithdrawApplicationResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly INotificationRepository? _notificationRepository;

    public WithdrawApplicationCommandHandler(
        IApplicationRepository applicationRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService,
        INotificationRepository? notificationRepository = null)
    {
        _applicationRepository = applicationRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _notificationRepository = notificationRepository;
    }

    public async Task<WithdrawApplicationResponse> Handle(WithdrawApplicationCommand request, CancellationToken cancellationToken)
    {
        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển.");

        if (application.Candidate?.UserId != request.CurrentUserId)
        {
            throw new ForbiddenException("Bạn chỉ có thể rút hồ sơ ứng tuyển của chính mình.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, application.ConcurrencyToken, "hồ sơ");

        if (application.Status is ApplicationStates.Rejected or ApplicationStates.InterviewFailed or ApplicationStates.BackupNotSelected
            or ApplicationStates.OfferDeclined or ApplicationStates.NotStarted or ApplicationStates.Withdrawn
            or ApplicationStates.Placed or ApplicationStates.Closed)
        {
            throw new BadRequestException($"Không thể rút hồ sơ đang ở trạng thái {application.Status}.");
        }

        var now = DateTime.UtcNow;
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? "Ứng viên đã rút hồ sơ ứng tuyển." : request.Reason.Trim();
        var cancelledCount = 0;
        foreach (var interview in application.Interviews.Where(i => i.Status == InterviewStates.Scheduled))
        {
            interview.Status = InterviewStates.Cancelled;
            interview.UpdatedAt = now;
            interview.ConcurrencyToken = Guid.NewGuid();
            interview.InterviewStatusHistories.Add(new InterviewStatusHistory
            {
                InterviewStatusHistoryId = Guid.NewGuid(),
                InterviewId = interview.InterviewId,
                OldStatus = InterviewStates.Scheduled,
                NewStatus = InterviewStates.Cancelled,
                OldScheduledAt = interview.ScheduledAt,
                NewScheduledAt = null,
                ChangedBy = request.CurrentUserId,
                ChangedAt = now,
                Reason = reason
            });
            cancelledCount++;
        }

        var withdrawnOfferCount = 0;
        foreach (var offer in application.Offers.Where(o => o.Status is OfferStates.Draft or OfferStates.Sent))
        {
            offer.Status = OfferStates.Withdrawn;
            offer.UpdatedAt = now;
            offer.ConcurrencyToken = Guid.NewGuid();
            withdrawnOfferCount++;
        }

        var oldStatus = application.Status;
        application.Status = ApplicationStates.Withdrawn;
        application.StatusReason = reason;
        application.UpdatedAt = now;
        application.ConcurrencyToken = Guid.NewGuid();
        application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OldStatus = oldStatus,
            NewStatus = ApplicationStates.Withdrawn,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = reason
        });

        _applicationRepository.Update(application);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationWithdrawn,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus },
            NewValues = new { status = application.Status, cancelledInterviewCount = cancelledCount, withdrawnOfferCount, hasReason = true }
        }, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationStatusChanged,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus },
            NewValues = new { status = application.Status, sourceAction = AuditActions.ApplicationWithdrawn }
        }, cancellationToken);

        if (_notificationRepository != null && application.Job?.CreatedBy is { } jobOwnerId && jobOwnerId != Guid.Empty)
        {
            await _notificationRepository.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = jobOwnerId,
                NotificationType = "APPLICATION_STATUS",
                Title = "Ứng viên đã rút hồ sơ ứng tuyển",
                Message = $"Ứng viên {application.Candidate?.FullName} đã rút hồ sơ ứng tuyển vị trí {application.Job?.Title}.",
                RelatedEntityType = "APPLICATION",
                RelatedEntityId = application.ApplicationId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    applicationId = application.ApplicationId,
                    candidateId = application.CandidateId,
                    jobId = application.JobId,
                    reason
                }),
                IsRead = false,
                CreatedAt = now
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new WithdrawApplicationResponse(
            application.ApplicationId,
            application.Status,
            cancelledCount,
            withdrawnOfferCount,
            application.ConcurrencyToken,
            now);
    }
}
