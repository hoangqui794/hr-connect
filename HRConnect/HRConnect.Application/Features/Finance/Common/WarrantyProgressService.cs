using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;

namespace HRConnect.Application.Features.Finance.Common;

public interface IWarrantyProgressService
{
    /// <summary>
    /// When an ACTIVE warranty has ended, mark it PASSED and earn its PENDING commissions in full.
    /// Returns false when there is nothing to do (already processed, claimed, or not yet due).
    /// </summary>
    Task<bool> CompleteWarrantyAsync(Guid placementId, DateOnly today, CancellationToken cancellationToken = default);

    /// <summary>Marks a PENDING service fee past its due date as OVERDUE.</summary>
    Task<bool> MarkServiceFeeOverdueAsync(Guid serviceFeeId, DateOnly today, CancellationToken cancellationToken = default);
}

public sealed class WarrantyProgressService : IWarrantyProgressService
{
    private readonly IFinanceRepository _financeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;

    public WarrantyProgressService(IFinanceRepository financeRepository, IUnitOfWork unitOfWork, IAuditLogService auditLogService)
    {
        _financeRepository = financeRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
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

        var earned = placement.Commissions.Where(c => c.Status == CommissionStates.Pending).ToList();
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
                OldValues = new { status = CommissionStates.Pending },
                NewValues = new { status = commission.Status, amount = commission.Amount },
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> MarkServiceFeeOverdueAsync(Guid serviceFeeId, DateOnly today, CancellationToken cancellationToken = default)
    {
        var fee = await _financeRepository.GetServiceFeeForUpdateAsync(serviceFeeId, cancellationToken);
        if (fee == null || fee.Status != ServiceFeeStates.Pending || fee.DueDate >= today)
        {
            return false;
        }

        fee.Status = ServiceFeeStates.Overdue;
        fee.UpdatedAt = DateTime.UtcNow;
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ServiceFeeOverdue,
            EntityType = "SERVICE_FEE",
            EntityId = fee.ServiceFeeId,
            ActorType = AuditActorTypes.Service,
            OldValues = new { status = ServiceFeeStates.Pending },
            NewValues = new { status = fee.Status, dueDate = fee.DueDate },
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}
