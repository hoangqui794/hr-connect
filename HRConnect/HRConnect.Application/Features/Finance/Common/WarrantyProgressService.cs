using HRConnect.Application.Common;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Finance.Common;

public interface IWarrantyProgressService
{
    /// <summary>
    /// When an ACTIVE warranty has ended, mark it PASSED and earn its IN_WARRANTY commissions in full.
    /// ON_HOLD (a resignation under review) is never earned automatically.
    /// Returns false when there is nothing to do (already processed, claimed, or not yet due).
    /// </summary>
    Task<bool> CompleteWarrantyAsync(Guid placementId, DateOnly today, CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks a PENDING or DUE service fee past its due date as OVERDUE.
    /// Pass <paramref name="actorUserId"/> when a user's request triggers it; null means the background worker.
    /// </summary>
    Task<bool> MarkServiceFeeOverdueAsync(Guid serviceFeeId, DateOnly today, Guid? actorUserId = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// PENDING -> DUE when the fee is due within <paramref name="reminderDays"/> days, and reminds the Client's
    /// active users. Returns false when there is nothing to do.
    /// Pass <paramref name="actorUserId"/> when a user's request triggers it; null means the background worker.
    /// </summary>
    Task<bool> MarkServiceFeeDueAsync(Guid serviceFeeId, DateOnly today, int reminderDays, Guid? actorUserId = null, CancellationToken cancellationToken = default);

    /// <summary>OPEN replacement slot past its deadline -> EXPIRED, and tells the Client. Returns false when there is nothing to do.</summary>
    Task<bool> ExpireReplacementSlotAsync(Guid replacementSlotId, DateTime now, CancellationToken cancellationToken = default);

    /// <summary>
    /// Safety net for S2: a WAITING_PAYMENT replacement slot whose fee is already PAID opens now, the same way
    /// recording the payment would have opened it. Returns false when there is nothing to do.
    /// </summary>
    Task<bool> OpenPaidReplacementSlotAsync(Guid replacementSlotId, DateTime now, CancellationToken cancellationToken = default);
}

public sealed class WarrantyProgressService : IWarrantyProgressService
{
    private readonly IFinanceRepository _financeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly INotificationRepository? _notificationRepository;
    private readonly IPlacementReconciliationRepository? _reconciliationRepository;
    private readonly IAdminBusinessSettings? _settings;
    private readonly IAppNotifier? _notifier;

    public WarrantyProgressService(
        IFinanceRepository financeRepository, IUnitOfWork unitOfWork, IAuditLogService auditLogService,
        INotificationRepository? notificationRepository = null,
        IPlacementReconciliationRepository? reconciliationRepository = null,
        IAdminBusinessSettings? settings = null,
        IAppNotifier? notifier = null)
    {
        _financeRepository = financeRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _notificationRepository = notificationRepository;
        _reconciliationRepository = reconciliationRepository;
        _settings = settings;
        _notifier = notifier;
    }

    public async Task<bool> CompleteWarrantyAsync(Guid placementId, DateOnly today, CancellationToken cancellationToken = default)
    {
        var placement = await _financeRepository.GetPlacementForFinanceAsync(placementId, cancellationToken);
        var warranty = placement?.Warranty;
        if (placement == null || warranty == null || warranty.Status != WarrantyStates.Active
            || warranty.EndDate is not DateOnly endDate || endDate > today)
        {
            return false;
        }

        if (!await CanCompleteWarrantyAsync(placement, cancellationToken))
        {
            return false;
        }

        var now = DateTime.UtcNow;
        warranty.Status = WarrantyStates.Passed;
        warranty.ResultNote = $"Ứng viên đã làm đủ thời hạn bảo hành đến {endDate:yyyy-MM-dd}.";
        warranty.UpdatedAt = now;

        var inWarranty = placement.Commissions
            .Where(c => c.Status == CommissionStates.InWarranty)
            .ToList();
        var earned = new List<Commission>();
        var held = new List<Commission>();
        var suspendedByAttribution = new Dictionary<Guid, bool>();
        foreach (var commission in inWarranty)
        {
            if (!suspendedByAttribution.TryGetValue(commission.AttributionId, out var isSuspended))
            {
                isSuspended = await _financeRepository.IsAffiliateSuspendedAsync(commission.AttributionId, cancellationToken);
                suspendedByAttribution[commission.AttributionId] = isSuspended;
            }

            commission.UpdatedAt = now;
            if (isSuspended)
            {
                commission.Status = CommissionStates.OnHold;
                held.Add(commission);
            }
            else
            {
                commission.Status = CommissionStates.Earned;
                earned.Add(commission);
            }
        }

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.WarrantyPassed,
            EntityType = "WARRANTY",
            EntityId = warranty.WarrantyId,
            ActorType = AuditActorTypes.Service,
            ServiceName = "WarrantyProgressWorker",
            OldValues = new { status = WarrantyStates.Active },
            NewValues = new { status = warranty.Status, placementId, endDate },
        }, cancellationToken);
        foreach (var commission in earned)
        {
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.CommissionEarned,
                EntityType = "COMMISSION",
                EntityId = commission.CommissionId,
                ActorType = AuditActorTypes.Service,
                ServiceName = "WarrantyProgressWorker",
                OldValues = new { status = CommissionStates.InWarranty },
                NewValues = new { status = commission.Status, amount = commission.Amount },
            }, cancellationToken);
        }
        foreach (var commission in held)
        {
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.CommissionHeldAffiliateSuspended,
                EntityType = "COMMISSION",
                EntityId = commission.CommissionId,
                ActorType = AuditActorTypes.Service,
                ServiceName = "WarrantyProgressWorker",
                OldValues = new { status = CommissionStates.InWarranty },
                NewValues = new
                {
                    status = commission.Status,
                    amount = commission.Amount,
                    attributionId = commission.AttributionId,
                    reason = "Bảo hành đã đạt nhưng Affiliate đang bị tạm khóa (SUSPENDED), giữ hoa hồng ON_HOLD thay vì chuyển EARNED.",
                },
            }, cancellationToken);
        }

        if (_notifier != null)
        {
            var jobTitle = placement.Application?.Job?.Title ?? "vị trí tuyển dụng";
            var currency = placement.ServiceFee?.CurrencyCode ?? placement.Application?.Job?.CurrencyCode;
            foreach (var commission in earned)
            {
                var formatted = FinanceCurrency.FormatMoney(commission.Amount, currency);
                await _notifier.NotifyRoleAsync("PLATFORM_ADMIN", new AppNotice(
                    "COMMISSION",
                    "Hoa hồng Affiliate chờ duyệt chi",
                    $"Ứng viên của vị trí \"{jobTitle}\" đã làm đủ thời hạn bảo hành. Khoản hoa hồng {formatted} đang chờ Admin duyệt chi.",
                    "COMMISSION",
                    commission.CommissionId,
                    "/admin/payouts"), cancellationToken);

                if (await _financeRepository.GetAffiliateUserIdAsync(commission.AttributionId, cancellationToken) is Guid affiliateUserId
                    && affiliateUserId != Guid.Empty)
                {
                    await _notifier.NotifyUsersAsync([affiliateUserId], new AppNotice(
                        "COMMISSION",
                        "Hoa hồng đủ điều kiện chi trả",
                        $"Ứng viên của vị trí \"{jobTitle}\" đã hoàn tất thời hạn bảo hành. Khoản hoa hồng {formatted} đã chuyển sang trạng thái đủ điều kiện nhận.",
                        "COMMISSION",
                        commission.CommissionId,
                        "/affiliate/commissions"), cancellationToken);
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> MarkServiceFeeOverdueAsync(Guid serviceFeeId, DateOnly today, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        if (!await CanAdvanceFeeAsync(serviceFeeId, cancellationToken))
        {
            return false;
        }

        var fee = await _financeRepository.GetServiceFeeForUpdateAsync(serviceFeeId, cancellationToken);
        if (fee == null || fee.Status is not (ServiceFeeStates.Pending or ServiceFeeStates.Due) || fee.DueDate >= today)
        {
            return false;
        }

        var oldStatus = fee.Status;
        var now = DateTime.UtcNow;
        fee.Status = ServiceFeeStates.Overdue;
        fee.UpdatedAt = now;
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ServiceFeeOverdue,
            EntityType = "SERVICE_FEE",
            EntityId = fee.ServiceFeeId,
            ActorUserId = actorUserId,
            ActorType = actorUserId.HasValue ? AuditActorTypes.User : AuditActorTypes.Service,
            ServiceName = actorUserId.HasValue ? null : "WarrantyProgressWorker",
            OldValues = new { status = oldStatus },
            NewValues = new { status = fee.Status, dueDate = fee.DueDate },
        }, cancellationToken);

        var formattedAmount = FinanceCurrency.FormatMoney(fee.Amount, fee.CurrencyCode);
        if (_notifier != null)
        {
            await _notifier.NotifyRoleAsync("PLATFORM_ADMIN", new AppNotice(
                "SERVICE_FEE",
                "Công nợ phí dịch vụ quá hạn",
                $"Doanh nghiệp có khoản phí dịch vụ {fee.Amount:N0} {fee.CurrencyCode} đã quá hạn thanh toán ({fee.DueDate:dd/MM/yyyy}).",
                "SERVICE_FEE",
                fee.ServiceFeeId,
                "/admin/payouts"), cancellationToken);
        }

        if (!ServiceFeeKinds.OwedToClient.Contains(fee.Kind))
        {
            await CompanyFinanceNotice.SendAsync(
                _financeRepository,
                _notifier,
                _notificationRepository,
                fee.CompanyId,
                new AppNotice(
                    "SERVICE_FEE",
                    "Phí dịch vụ đã quá hạn thanh toán",
                    $"Phí dịch vụ {formattedAmount} đã quá hạn thanh toán ({fee.DueDate:dd/MM/yyyy}). Vui lòng thanh toán để hoàn tất công nợ.",
                    "SERVICE_FEE",
                    fee.ServiceFeeId,
                    "/client/billing"),
                now,
                cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> MarkServiceFeeDueAsync(Guid serviceFeeId, DateOnly today, int reminderDays, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        if (!await CanAdvanceFeeAsync(serviceFeeId, cancellationToken))
        {
            return false;
        }

        var fee = await _financeRepository.GetServiceFeeForUpdateAsync(serviceFeeId, cancellationToken);
        if (fee == null || fee.Status != ServiceFeeStates.Pending || fee.DueDate < today
            || fee.DueDate > today.AddDays(Math.Max(0, reminderDays)))
        {
            return false;
        }

        var now = DateTime.UtcNow;
        fee.Status = ServiceFeeStates.Due;
        fee.UpdatedAt = now;
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ServiceFeeDue,
            EntityType = "SERVICE_FEE",
            EntityId = fee.ServiceFeeId,
            ActorUserId = actorUserId,
            ActorType = actorUserId.HasValue ? AuditActorTypes.User : AuditActorTypes.Service,
            ServiceName = actorUserId.HasValue ? null : "WarrantyProgressWorker",
            OldValues = new { status = ServiceFeeStates.Pending },
            NewValues = new { status = fee.Status, dueDate = fee.DueDate, reminderDays },
        }, cancellationToken);

        if (_notificationRepository != null)
        {
            var daysLeft = fee.DueDate.DayNumber - today.DayNumber;
            var message = daysLeft == 0
                ? $"Phí dịch vụ {fee.Amount:N0} {fee.CurrencyCode} đến hạn thanh toán hôm nay ({fee.DueDate:dd/MM/yyyy})."
                : $"Phí dịch vụ {fee.Amount:N0} {fee.CurrencyCode} còn {daysLeft} ngày tới hạn thanh toán ({fee.DueDate:dd/MM/yyyy}).";
            foreach (var userId in await _financeRepository.GetActiveCompanyUserIdsAsync(fee.CompanyId, cancellationToken))
            {
                await _notificationRepository.AddAsync(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = userId,
                    NotificationType = "COMPANY",
                    Title = "Phí dịch vụ sắp đến hạn thanh toán",
                    Message = message,
                    RelatedEntityType = "SERVICE_FEE",
                    RelatedEntityId = fee.ServiceFeeId,
                    Metadata = System.Text.Json.JsonSerializer.Serialize(new { serviceFeeId = fee.ServiceFeeId, fee.DueDate, fee.Amount }),
                    IsRead = false,
                    CreatedAt = now,
                }, cancellationToken);
            }
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<bool> CanAdvanceFeeAsync(Guid serviceFeeId, CancellationToken cancellationToken)
    {
        if (_reconciliationRepository == null)
        {
            return true;
        }

        var reconciliation = await _reconciliationRepository.GetByServiceFeeIdAsync(serviceFeeId, cancellationToken);
        return IsReconciliationConfirmedOrAbsent(reconciliation);
    }

    private async Task<bool> CanCompleteWarrantyAsync(Placement placement, CancellationToken cancellationToken)
    {
        if (_reconciliationRepository == null)
        {
            return true;
        }

        var reconciliation = placement.ServiceFee is { } serviceFee
            ? await _reconciliationRepository.GetByServiceFeeIdAsync(serviceFee.ServiceFeeId, cancellationToken)
            : await _reconciliationRepository.GetByPlacementIdAsync(placement.PlacementId, cancellationToken);

        return IsReconciliationConfirmedOrAbsent(reconciliation);
    }

    private static bool IsReconciliationConfirmedOrAbsent(PlacementReconciliation? reconciliation) =>
        reconciliation == null ||
        string.Equals(reconciliation.Status, PlacementReconciliationStates.Confirmed, StringComparison.OrdinalIgnoreCase);

    public async Task<bool> OpenPaidReplacementSlotAsync(Guid replacementSlotId, DateTime now, CancellationToken cancellationToken = default)
    {
        var slot = await _financeRepository.GetReplacementSlotForUpdateAsync(replacementSlotId, cancellationToken);
        if (slot is not { Status: ReplacementSlotStates.WaitingPayment } || slot.ServiceFee?.Status != ServiceFeeStates.Paid)
        {
            return false;
        }

        await ReplacementSlotLifecycle.OpenAsync(
            slot, slot.Job, now, null, _financeRepository, _notificationRepository, cancellationToken);
        await ReplacementSlotLifecycle.NotifyAffiliateOpenAsync(
            slot, slot.Job, extended: false, _financeRepository, _notifier, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ReplacementSlotOpened,
            EntityType = "REPLACEMENT_SLOT",
            EntityId = slot.ReplacementSlotId,
            ActorType = AuditActorTypes.Service,
            ServiceName = "WarrantyProgressWorker",
            OldValues = new { status = ReplacementSlotStates.WaitingPayment },
            NewValues = new { slot.Status, slot.OpenedAt, slot.ExpiresAt, reason = "FEE_ALREADY_PAID" },
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ExpireReplacementSlotAsync(Guid replacementSlotId, DateTime now, CancellationToken cancellationToken = default)
    {
        var slot = await _financeRepository.GetReplacementSlotForUpdateAsync(replacementSlotId, cancellationToken);
        if (slot == null || slot.Status != ReplacementSlotStates.Open || slot.ExpiresAt == null || slot.ExpiresAt > now)
        {
            return false;
        }

        if (await TryExtendReplacementSlotAsync(slot, now, cancellationToken))
        {
            return true;
        }

        slot.Status = ReplacementSlotStates.Expired;
        slot.ClosedAt = now;
        slot.ConcurrencyToken = Guid.NewGuid();
        slot.UpdatedAt = now;
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ReplacementSlotExpired,
            EntityType = "REPLACEMENT_SLOT",
            EntityId = slot.ReplacementSlotId,
            ActorType = AuditActorTypes.Service,
            ServiceName = "WarrantyProgressWorker",
            OldValues = new { status = ReplacementSlotStates.Open },
            NewValues = new { status = slot.Status, slot.ExpiresAt },
        }, cancellationToken);
        var refund = await CreateReplacementRefundAsync(slot, now, cancellationToken);
        var message = $"Suất thay thế của job \"{slot.Job.Title}\" đã hết hạn ngày {slot.ExpiresAt:dd/MM/yyyy} mà chưa có người đi làm.";
        if (refund != null)
        {
            message += $" HR Connect sẽ hoàn {refund.Amount:N0} {refund.CurrencyCode} phí dịch vụ cho bạn.";
        }

        await ReplacementSlotLifecycle.NotifyClientAsync(slot.Job, slot, "Suất tuyển người thay thế đã hết hạn",
            message, now, _financeRepository, _notificationRepository, cancellationToken);

        if (refund != null && _notifier != null)
        {
            await _notifier.NotifyRoleAsync("PLATFORM_ADMIN", new AppNotice(
                "SERVICE_FEE",
                $"Cần hoàn {decimal.Round(refund.FeeMultiplier * 100m, 2):0.##}% phí dịch vụ",
                $"Suất thay thế của công ty {slot.Job.Company?.CompanyName ?? "Doanh nghiệp"} (vị trí \"{slot.Job.Title}\") đã hết hạn. Cần xử lý lệnh hoàn {refund.Amount:N0} {refund.CurrencyCode} cho doanh nghiệp.",
                "SERVICE_FEE",
                refund.ServiceFeeId,
                "/admin/payouts"), cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>
    /// A slot gets one more window before it can expire, so a refund is the last resort.
    /// </summary>
    private async Task<bool> TryExtendReplacementSlotAsync(ReplacementSlot slot, DateTime now, CancellationToken cancellationToken)
    {
        if (_settings == null || slot.ExtendedAt != null)
        {
            return false;
        }

        var days = await _settings.GetIntAsync(BusinessSettingKeys.ReplacementExtensionDays, cancellationToken);
        if (days <= 0)
        {
            return false;
        }

        var previousExpiry = slot.ExpiresAt;
        slot.ExtendedAt = now;
        slot.ExpiresAt = now.AddDays(days);
        slot.ConcurrencyToken = Guid.NewGuid();
        slot.UpdatedAt = now;
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ReplacementSlotExtended,
            EntityType = "REPLACEMENT_SLOT",
            EntityId = slot.ReplacementSlotId,
            ActorType = AuditActorTypes.Service,
            ServiceName = "WarrantyProgressWorker",
            OldValues = new { expiresAt = previousExpiry },
            NewValues = new { slot.ExpiresAt, extensionDays = days },
        }, cancellationToken);
        await ReplacementSlotLifecycle.NotifyClientAsync(slot.Job, slot, "Suất tuyển người thay thế được gia hạn",
            $"Chưa có người đi làm cho job \"{slot.Job.Title}\", HR Connect gia hạn suất thay thế miễn phí tới {slot.ExpiresAt:dd/MM/yyyy}.",
            now, _financeRepository, _notificationRepository, cancellationToken);
        await ReplacementSlotLifecycle.NotifyAffiliateOpenAsync(
            slot, slot.Job, extended: true, _financeRepository, _notifier, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>
    /// Refund a share of the paid fee only when HR Connect brought the Client nobody during the window.
    /// A Client who was sent candidates and took none gets no refund, so refusing cannot earn money back.
    /// </summary>
    private async Task<ServiceFee?> CreateReplacementRefundAsync(ReplacementSlot slot, DateTime now, CancellationToken cancellationToken)
    {
        if (_settings == null || slot.ServiceFee.Status != ServiceFeeStates.Paid)
        {
            return null;
        }

        var percent = await _settings.GetDecimalAsync(BusinessSettingKeys.ReplacementRefundPercent, cancellationToken);
        if (percent <= 0m
            || await _financeRepository.HasReplacementCandidateReachedClientAsync(slot.ReplacementSlotId, cancellationToken))
        {
            return null;
        }

        var paidDays = await _settings.GetIntAsync(BusinessSettingKeys.HeadhuntPaymentDueDays, cancellationToken);
        var refund = new ServiceFee
        {
            ServiceFeeId = Guid.NewGuid(),
            JobId = slot.JobId,
            Kind = ServiceFeeKinds.ReplacementRefund,
            CompanyId = slot.ServiceFee.CompanyId,
            BaseSalary = slot.ServiceFee.Amount,
            FeeMultiplier = percent / 100m,
            Amount = decimal.Round(slot.ServiceFee.Amount * percent / 100m, 0, MidpointRounding.AwayFromZero),
            CurrencyCode = slot.ServiceFee.CurrencyCode,
            DueDate = VietnamTime.Today(now).AddDays(paidDays),
            Status = ServiceFeeStates.Pending,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _financeRepository.AddServiceFeeAsync(refund, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ReplacementRefundCreated,
            EntityType = "SERVICE_FEE",
            EntityId = refund.ServiceFeeId,
            ActorType = AuditActorTypes.Service,
            ServiceName = "WarrantyProgressWorker",
            NewValues = new { slot.ReplacementSlotId, originalServiceFeeId = slot.ServiceFeeId, percent, refund.Amount },
        }, cancellationToken);
        return refund;
    }
}

/// <summary>Sends one company notice via IAppNotifier (with SignalR), falling back to INotificationRepository when notifier is absent.</summary>
internal static class CompanyFinanceNotice
{
    public static async Task SendAsync(
        IFinanceRepository financeRepository,
        IAppNotifier? notifier,
        INotificationRepository? notificationRepository,
        Guid companyId,
        AppNotice notice,
        DateTime now,
        CancellationToken cancellationToken)
    {
        if (notifier != null)
        {
            await notifier.NotifyCompanyAsync(companyId, notice, cancellationToken);
            return;
        }

        if (notificationRepository == null)
        {
            return;
        }

        var metadata = System.Text.Json.JsonSerializer.Serialize(new { routeHint = notice.RouteHint, entityId = notice.RelatedEntityId });
        foreach (var userId in await financeRepository.GetActiveCompanyUserIdsAsync(companyId, cancellationToken))
        {
            await notificationRepository.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = userId,
                NotificationType = notice.NotificationType,
                Title = notice.Title,
                Message = notice.Message,
                RelatedEntityType = notice.RelatedEntityType,
                RelatedEntityId = notice.RelatedEntityId,
                Metadata = metadata,
                IsRead = false,
                CreatedAt = now,
            }, cancellationToken);
        }
    }
}
