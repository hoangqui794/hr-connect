using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Finance.Common;

/// <summary>
/// Shared state changes for replacement slots (docs/MF05/mf05-thiet-ke-suat-thay-the.md, section 3),
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
}
