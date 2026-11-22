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
    private readonly IAppNotifier? _notifier;

    public WithdrawApplicationCommandHandler(
        IApplicationRepository applicationRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService,
        IAppNotifier? notifier = null)
    {
        _applicationRepository = applicationRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _notifier = notifier;
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
        foreach (var offer in application.Offers.Where(o =>
                     o.Status is OfferStates.Draft or OfferStates.Sent or OfferStates.Accepted))
        {
            offer.Status = OfferStates.Withdrawn;
            offer.DeclineReason = reason;
            offer.RespondedAt ??= now;
            offer.UpdatedAt = now;
            offer.ConcurrencyToken = Guid.NewGuid();
            withdrawnOfferCount++;
        }

        var oldStatus = application.Status;
        // Decided before the status changes: could the Client Company see this application?
        var serviceTypeCode = application.Job?.ServiceType?.Code;
        var visibleToClient = ClientVisibilityPolicy.IsVisibleToClient(
            serviceTypeCode,
            oldStatus,
            (application.ApplicationStatusHistories ?? []).Select(h => h.NewStatus),
            application.SourcingDeliveries?.Any() ?? false);
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

        await NotifyWithdrawalAsync(application, visibleToClient, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new WithdrawApplicationResponse(
            application.ApplicationId,
            application.Status,
            cancelledCount,
            withdrawnOfferCount,
            application.ConcurrencyToken,
            now);
    }

    /// <summary>
    /// The Client Company hears about a withdrawal only for an application it could already see
    /// (ClientVisibilityPolicy): before a HEADHUNT_COD shortlist or a CV_SOURCING delivery the candidate is
    /// still in Internal HR's screening queue, so Internal HR is told instead and the Client learns nothing
    /// about a candidate it never saw. The candidate's free-text reason is not put in the message.
    /// </summary>
    private async Task NotifyWithdrawalAsync(
        HRConnect.Domain.Entities.Application application,
        bool visibleToClient,
        CancellationToken cancellationToken)
    {
        if (_notifier == null || application.Job == null)
        {
            return;
        }

        var candidateName = string.IsNullOrWhiteSpace(application.Candidate?.FullName)
            ? "Ứng viên"
            : $"Ứng viên {application.Candidate!.FullName}";
        var message = $"{candidateName} đã rút hồ sơ ứng tuyển vị trí \"{application.Job.Title}\".";

        if (visibleToClient)
        {
            await _notifier.NotifyCompanyAsync(application.Job.CompanyId, new AppNotice(
                ApplicationScreeningNotificationFactory.NotificationType,
                "Ứng viên đã rút hồ sơ ứng tuyển",
                message,
                "APPLICATION",
                application.ApplicationId,
                $"/client/candidates?open={application.ApplicationId}"), cancellationToken);
            return;
        }

        await _notifier.NotifyRoleAsync(RoleCodes.InternalHr, new AppNotice(
            ApplicationScreeningNotificationFactory.NotificationType,
            "Ứng viên đã rút hồ sơ ứng tuyển",
            message,
            "APPLICATION",
            application.ApplicationId,
            $"/hr/screening?status=all&open={application.ApplicationId}"), cancellationToken);
    }
}
