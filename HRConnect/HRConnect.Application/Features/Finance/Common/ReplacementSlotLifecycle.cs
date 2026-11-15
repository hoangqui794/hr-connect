using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Finance.Common;

/// <summary>
/// Shared state changes for replacement slots (docs/main-flows.md (MF-05, suất thay thế), section 3),
/// used when a resignation is confirmed (S1), when the Client pays (S2) and by the worker (S3).
/// </summary>
internal static class ReplacementSlotLifecycle
{
    /// <summary>
    /// WAITING_PAYMENT (or new) -> OPEN: starts the fill window and reopens a CLOSED job so
    /// Affiliates can submit again. The caller saves.
    /// </summary>
    public static async Task OpenAsync(
        ReplacementSlot slot, Job job, DateTime now, Guid? actorUserId,
        IFinanceRepository financeRepository, INotificationRepository? notificationRepository, CancellationToken cancellationToken)
    {
        slot.Status = ReplacementSlotStates.Open;
        slot.OpenedAt = now;
        slot.ExpiresAt = now.AddDays(slot.FillWindowDays);
        slot.ConcurrencyToken = Guid.NewGuid();
        slot.UpdatedAt = now;

        if (job.Status == JobStatuses.Closed)
        {
            job.JobStatusHistories.Add(new JobStatusHistory
            {
                JobStatusHistoryId = Guid.NewGuid(),
                JobId = job.JobId,
                OldStatus = job.Status,
                NewStatus = JobStatuses.Active,
                ChangedBy = actorUserId,
                ReasonCode = ReplacementSlotErrorCodes.JobReopenedReason,
                ReasonText = $"Mở lại để tuyển người thay thế (suất {slot.ReplacementSlotId}).",
                ChangedAt = now,
            });
            job.Status = JobStatuses.Active;
            job.ClosedAt = null;
            job.StatusReasonCode = ReplacementSlotErrorCodes.JobReopenedReason;
            job.StatusChangedAt = now;
            job.ConcurrencyToken = Guid.NewGuid();
            job.UpdatedAt = now;
        }

        await NotifyClientAsync(job, slot, "Đã mở suất tuyển người thay thế",
            $"Job \"{job.Title}\" đang tuyển người thay thế miễn phí, hạn tới {slot.ExpiresAt:dd/MM/yyyy}.",
            now, financeRepository, notificationRepository, cancellationToken);
    }

    public static async Task NotifyClientAsync(
        Job job, ReplacementSlot slot, string title, string message, DateTime now,
        IFinanceRepository financeRepository, INotificationRepository? notificationRepository, CancellationToken cancellationToken)
    {
        if (notificationRepository == null)
        {
            return;
        }

        foreach (var userId in await financeRepository.GetActiveCompanyUserIdsAsync(job.CompanyId, cancellationToken))
        {
            await notificationRepository.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = userId,
                NotificationType = "COMPANY",
                Title = title,
                Message = message,
                RelatedEntityType = "REPLACEMENT_SLOT",
                RelatedEntityId = slot.ReplacementSlotId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new { replacementSlotId = slot.ReplacementSlotId, job.JobId, slot.Status, slot.ExpiresAt }),
                IsRead = false,
                CreatedAt = now,
            }, cancellationToken);
        }
    }

    /// <summary>
    /// Notifies originating Affiliates (credited on the resigned placement) when a replacement slot
    /// is OPEN or extended, linking directly to the candidate submission page for the job.
    /// </summary>
    public static async Task NotifyAffiliateOpenAsync(
        ReplacementSlot slot, Job? job, bool extended,
        IFinanceRepository financeRepository, IAppNotifier? notifier, CancellationToken cancellationToken)
    {
        if (notifier == null)
        {
            return;
        }

        var userIds = await financeRepository.GetAffiliateUserIdsByPlacementAsync(slot.OriginalPlacementId, cancellationToken);
        if (userIds.Count == 0)
        {
            return;
        }

        var jobTitle = job?.Title ?? "Vị trí tuyển dụng";
        var title = extended
            ? "Suất tuyển người thay thế được gia hạn"
            : "Đã mở suất tuyển người thay thế";
        var message = extended
            ? $"Vị trí \"{jobTitle}\" được gia hạn suất tuyển người thay thế tới {slot.ExpiresAt:dd/MM/yyyy}. Hãy giới thiệu ứng viên thay thế kịp thời."
            : $"Vị trí \"{jobTitle}\" đã mở lại suất tuyển người thay thế (hạn tới {slot.ExpiresAt:dd/MM/yyyy}). Bạn có thể giới thiệu ứng viên thay thế ngay.";
        await notifier.NotifyUsersAsync(userIds, new AppNotice(
            "WARRANTY",
            title,
            message,
            "REPLACEMENT_SLOT",
            slot.ReplacementSlotId,
            $"/affiliate/submit-candidate?job={slot.JobId}"), cancellationToken);
    }
}
