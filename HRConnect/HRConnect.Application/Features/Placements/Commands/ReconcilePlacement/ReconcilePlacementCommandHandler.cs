using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Placements.Commands.ReconcilePlacement;

public sealed class ReconcilePlacementCommandHandler : IRequestHandler<ReconcilePlacementCommand, ReconcilePlacementResponse>
{
    private readonly IPlacementReconciliationRepository _repository;
    private readonly INotificationRepository _notifications;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IWarrantyProgressService _warrantyProgress;
    private readonly IAdminBusinessSettings _settings;

    public ReconcilePlacementCommandHandler(
        IPlacementReconciliationRepository repository,
        INotificationRepository notifications,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        IWarrantyProgressService warrantyProgress,
        IAdminBusinessSettings settings)
    {
        _repository = repository;
        _notifications = notifications;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _warrantyProgress = warrantyProgress;
        _settings = settings;
    }

    public async Task<ReconcilePlacementResponse> Handle(ReconcilePlacementCommand request, CancellationToken cancellationToken)
    {
        var item = await _repository.GetByApplicationIdAsync(request.ApplicationId, cancellationToken: cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ đối soát kết quả nhận việc.");

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, item.ConcurrencyToken, "đối soát placement");
        if (!string.Equals(item.Status, PlacementReconciliationStates.Pending, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Hồ sơ đối soát đã được xử lý.", PlacementReconciliationErrorCodes.NotPending);
        }

        var decision = request.Decision?.Trim().ToUpperInvariant();
        if (decision is not (PlacementReconciliationDecisions.Confirm or PlacementReconciliationDecisions.Flag))
        {
            throw new BadRequestException("Kết quả đối soát không hợp lệ.", PlacementReconciliationErrorCodes.InvalidDecision);
        }

        var channel = request.ContactChannel?.Trim().ToUpperInvariant();
        if (channel == null || !PlacementReconciliationContactChannels.All.Contains(channel))
        {
            throw new BadRequestException("Kênh liên hệ đối soát không hợp lệ.", PlacementReconciliationErrorCodes.InvalidContactChannel);
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note?.Length > 1000)
        {
            throw new BadRequestException("Ghi chú đối soát không được vượt quá 1000 ký tự.");
        }
        if (decision == PlacementReconciliationDecisions.Flag && note == null)
        {
            throw new BadRequestException("Phải nhập ghi chú khi báo kết quả không khớp.", PlacementReconciliationErrorCodes.NoteRequired);
        }

        var now = DateTime.UtcNow;
        item.Status = decision == PlacementReconciliationDecisions.Confirm
            ? PlacementReconciliationStates.Confirmed
            : PlacementReconciliationStates.Flagged;
        item.ContactChannel = channel;
        item.Note = note;
        item.ReviewedBy = request.ActorUserId;
        item.ReviewedAt = now;
        item.UpdatedAt = now;
        item.ConcurrencyToken = Guid.NewGuid();

        var auditAction = item.Status == PlacementReconciliationStates.Confirmed
            ? AuditActions.PlacementReconciled
            : AuditActions.PlacementReconciliationFlagged;
        await _audit.AddAsync(new AuditEntry
        {
            Action = auditAction,
            EntityType = "PLACEMENT_RECONCILIATION",
            EntityId = item.ReconciliationId,
            ActorUserId = request.ActorUserId,
            OldValues = new { status = PlacementReconciliationStates.Pending },
            NewValues = new { item.Status, item.ClaimedOutcome, contactChannel = channel, hasNote = note != null }
        }, cancellationToken);

        if (item.Status == PlacementReconciliationStates.Flagged)
        {
            await NotifyFlaggedAsync(item, now, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        if (item.Status == PlacementReconciliationStates.Confirmed && item.Placement?.ServiceFee is { } fee)
        {
            var today = DateOnly.FromDateTime(now);
            if (fee.DueDate < today)
            {
                await _warrantyProgress.MarkServiceFeeOverdueAsync(fee.ServiceFeeId, today, cancellationToken);
            }
            else
            {
                var reminderDays = await _settings.GetIntAsync(BusinessSettingKeys.FeeDueReminderDays, cancellationToken);
                await _warrantyProgress.MarkServiceFeeDueAsync(fee.ServiceFeeId, today, reminderDays, cancellationToken);
            }
        }

        return new ReconcilePlacementResponse(item.ReconciliationId, item.ApplicationId, item.Status, item.ConcurrencyToken, now);
    }

    private async Task NotifyFlaggedAsync(PlacementReconciliation item, DateTime now, CancellationToken cancellationToken)
    {
        var title = "Kết quả nhận việc cần xử lý";
        var message = $"Kết quả Client khai cho ứng viên {item.Application.Candidate.FullName} tại vị trí {item.Application.Job.Title} không khớp khi đối soát.";
        foreach (var userId in await _repository.GetActivePlatformAdminUserIdsAsync(cancellationToken))
        {
            await AddNotificationAsync(userId, title, message, item, now, cancellationToken);
        }

        if (item.ClaimedOutcome == PlacementReconciliationOutcomes.NotStarted &&
            await _repository.GetAttributedAffiliateUserIdAsync(item.ApplicationId, cancellationToken) is Guid affiliateUserId)
        {
            await AddNotificationAsync(
                affiliateUserId,
                "Kết quả nhận việc đang được xác minh",
                $"Kết quả nhận việc của ứng viên {item.Application.Candidate.FullName} đang được HR Connect xác minh.",
                item,
                now,
                cancellationToken);
        }
    }

    private Task AddNotificationAsync(
        Guid userId,
        string title,
        string message,
        PlacementReconciliation item,
        DateTime now,
        CancellationToken cancellationToken) =>
        _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId,
            NotificationType = "SYSTEM",
            Title = title,
            Message = message,
            RelatedEntityType = "PLACEMENT_RECONCILIATION",
            RelatedEntityId = item.ReconciliationId,
            Metadata = JsonSerializer.Serialize(new { item.ApplicationId, item.ReconciliationId, item.Status }),
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);
}
