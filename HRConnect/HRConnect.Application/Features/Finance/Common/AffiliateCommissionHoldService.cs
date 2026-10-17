using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;

namespace HRConnect.Application.Features.Finance.Common;

/// <summary>
/// Commissions of a suspended affiliate (decision 2026-10-17): what is already earned (EARNED, PAYABLE) is
/// still paid; what is not yet earned (PENDING, IN_WARRANTY) goes ON_HOLD until Platform Admin decides —
/// cancel it, or reactivate the account, which releases the hold.
/// </summary>
public interface IAffiliateCommissionHoldService
{
    /// <summary>Holds and releases one batch each. Returns how many commissions changed.</summary>
    Task<(int Held, int Released)> RunAsync(CancellationToken cancellationToken = default);
}

public sealed class AffiliateCommissionHoldService : IAffiliateCommissionHoldService
{
    private const int BatchSize = 200;

    private readonly IFinanceRepository _financeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;

    public AffiliateCommissionHoldService(IFinanceRepository financeRepository, IUnitOfWork unitOfWork, IAuditLogService auditLogService)
    {
        _financeRepository = financeRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
    }

    public async Task<(int Held, int Released)> RunAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        var toHold = await _financeRepository.GetCommissionsOfSuspendedAffiliatesAsync(BatchSize, cancellationToken);
        foreach (var commission in toHold)
        {
            var oldStatus = commission.Status;
            commission.Status = CommissionStates.OnHold;
            commission.UpdatedAt = now;
            await AuditAsync(AuditActions.CommissionHeldAffiliateSuspended, commission.CommissionId, oldStatus, commission.Status, cancellationToken);
        }

        // A hold released here can only be a suspension hold: resignation holds keep the warranty CLAIMED.
        var toRelease = await _financeRepository.GetHeldCommissionsOfReactivatedAffiliatesAsync(BatchSize, cancellationToken);
        foreach (var commission in toRelease)
        {
            // The warranty may have passed while the affiliate was suspended; the warranty worker never
            // earns an ON_HOLD commission, so it is earned here.
            commission.Status = commission.Placement!.Warranty!.Status == WarrantyStates.Passed
                ? CommissionStates.Earned
                : CommissionStates.InWarranty;
            commission.UpdatedAt = now;
            await AuditAsync(AuditActions.CommissionReleasedAffiliateReactivated, commission.CommissionId, CommissionStates.OnHold, commission.Status, cancellationToken);
        }

        if (toHold.Count + toRelease.Count > 0)
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return (toHold.Count, toRelease.Count);
    }

    private Task AuditAsync(string action, Guid commissionId, string oldStatus, string newStatus, CancellationToken cancellationToken) =>
        _auditLogService.AddAsync(new AuditEntry
        {
            Action = action,
            EntityType = "COMMISSION",
            EntityId = commissionId,
            ActorType = AuditActorTypes.Service,
            OldValues = new { status = oldStatus },
            NewValues = new { status = newStatus },
        }, cancellationToken);
}
