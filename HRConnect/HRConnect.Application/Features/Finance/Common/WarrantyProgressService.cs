using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
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

    /// <summary>Marks a PENDING or DUE service fee past its due date as OVERDUE.</summary>
    Task<bool> MarkServiceFeeOverdueAsync(Guid serviceFeeId, DateOnly today, CancellationToken cancellationToken = default);

    /// <summary>
    /// PENDING -> DUE when the fee is due within <paramref name="reminderDays"/> days, and reminds the Client's
    /// active users. Returns false when there is nothing to do.
    /// </summary>
    Task<bool> MarkServiceFeeDueAsync(Guid serviceFeeId, DateOnly today, int reminderDays, CancellationToken cancellationToken = default);
}

public sealed class WarrantyProgressService : IWarrantyProgressService
{
    private readonly IFinanceRepository _financeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly INotificationRepository? _notificationRepository;

    public WarrantyProgressService(
        IFinanceRepository financeRepository, IUnitOfWork unitOfWork, IAuditLogService auditLogService,
        INotificationRepository? notificationRepository = null)
    {
        _financeRepository = financeRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _notificationRepository = notificationRepository;
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

        var now = DateTime.UtcNow;
        warranty.Status = WarrantyStates.Passed;
        warranty.ResultNote = $"Ứng viên đã làm đủ thời hạn bảo hành đến {endDate:yyyy-MM-dd}.";
        warranty.UpdatedAt = now;

        var earned = placement.Commissions
            .Where(c => c.Status == CommissionStates.InWarranty)
            .ToList();
        foreach (var commission in earned)
        {
            commission.Status = CommissionStates.Earned;
            commission.UpdatedAt = now;
        }

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.WarrantyPassed,
            EntityType = "WARRANTY",
            EntityId = warranty.WarrantyId,
            ActorType = AuditActorTypes.Service,
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
                OldValues = new { status = CommissionStates.InWarranty },
                NewValues = new { status = commission.Status, amount = commission.Amount },
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> MarkServiceFeeOverdueAsync(Guid serviceFeeId, DateOnly today, CancellationToken cancellationToken = default)
    {
        var fee = await _financeRepository.GetServiceFeeForUpdateAsync(serviceFeeId, cancellationToken);
        if (fee == null || fee.Status is not (ServiceFeeStates.Pending or ServiceFeeStates.Due) || fee.DueDate >= today)
        {
            return false;
        }

        var oldStatus = fee.Status;
        fee.Status = ServiceFeeStates.Overdue;
        fee.UpdatedAt = DateTime.UtcNow;
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ServiceFeeOverdue,
            EntityType = "SERVICE_FEE",
            EntityId = fee.ServiceFeeId,
            ActorType = AuditActorTypes.Service,
            OldValues = new { status = oldStatus },
            NewValues = new { status = fee.Status, dueDate = fee.DueDate },
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> MarkServiceFeeDueAsync(Guid serviceFeeId, DateOnly today, int reminderDays, CancellationToken cancellationToken = default)
    {
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
            ActorType = AuditActorTypes.Service,
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
}
