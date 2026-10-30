using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class FinanceRepository : IFinanceRepository
{
    private const string ActiveAttribution = "ACTIVE";
    private const string ServiceTypeCvSourcing = "CV_SOURCING";
    private const string ClosedJob = "CLOSED";
    private const string SuspendedUser = "SUSPENDED";
    private const string ActiveUser = "ACTIVE";

    private readonly ApplicationDbContext _context;

    public FinanceRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<CommissionRule?> GetActiveCommissionRuleAsync(Guid serviceTypeId, DateTime at, CancellationToken cancellationToken = default) =>
        _context.CommissionRules.AsNoTracking()
            .Where(rule => rule.ServiceTypeId == serviceTypeId && rule.IsActive
                && (rule.EffectiveFrom == null || rule.EffectiveFrom <= at)
                && (rule.EffectiveTo == null || rule.EffectiveTo > at))
            // The most recently effective rule wins when several overlap.
            .OrderByDescending(rule => rule.EffectiveFrom)
            .ThenByDescending(rule => rule.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<Attribution?> GetActiveAttributionAsync(Guid applicationId, CancellationToken cancellationToken = default) =>
        _context.Attributions.AsNoTracking()
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId && a.Status == ActiveAttribution, cancellationToken);

    public async Task AddWarrantyAsync(Warranty warranty, CancellationToken cancellationToken = default) =>
        await _context.Warranties.AddAsync(warranty, cancellationToken);

    public async Task AddServiceFeeAsync(ServiceFee serviceFee, CancellationToken cancellationToken = default) =>
        await _context.ServiceFees.AddAsync(serviceFee, cancellationToken);

    public async Task AddCommissionAsync(Commission commission, CancellationToken cancellationToken = default) =>
        await _context.Commissions.AddAsync(commission, cancellationToken);

    public async Task AddCommissionAdjustmentAsync(CommissionAdjustment adjustment, CancellationToken cancellationToken = default) =>
        await _context.CommissionAdjustments.AddAsync(adjustment, cancellationToken);

    public async Task AddPayoutAsync(Payout payout, CancellationToken cancellationToken = default) =>
        await _context.Payouts.AddAsync(payout, cancellationToken);

    public async Task AddReplacementSlotAsync(ReplacementSlot slot, CancellationToken cancellationToken = default) =>
        await _context.ReplacementSlots.AddAsync(slot, cancellationToken);

    public Task<ReplacementSlot?> GetEarliestOpenReplacementSlotForJobAsync(
        Guid jobId,
        DateTime now,
        CancellationToken cancellationToken = default) =>
        _context.ReplacementSlots.AsNoTracking()
            .Where(s => s.JobId == jobId &&
                        s.Status == ReplacementSlotStates.Open &&
                        s.OpenedAt != null &&
                        s.ExpiresAt != null &&
                        s.ExpiresAt > now)
            .OrderBy(s => s.OpenedAt)
            .ThenBy(s => s.CreatedAt)
            .ThenBy(s => s.ReplacementSlotId)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<ReplacementSlot?> GetReplacementSlotByServiceFeeForUpdateAsync(Guid serviceFeeId, CancellationToken cancellationToken = default) =>
        _context.ReplacementSlots.Include(s => s.Job)
            .FirstOrDefaultAsync(s => s.ServiceFeeId == serviceFeeId, cancellationToken);

    public Task<ReplacementSlot?> GetReplacementSlotForUpdateAsync(Guid replacementSlotId, CancellationToken cancellationToken = default) =>
        _context.ReplacementSlots.Include(s => s.Job)
            .FirstOrDefaultAsync(s => s.ReplacementSlotId == replacementSlotId, cancellationToken);

    public Task<ReplacementSlot?> GetReplacementSlotForConsentForUpdateAsync(
        Guid replacementSlotId,
        CancellationToken cancellationToken = default)
        => GetReplacementSlotWithLockAsync(replacementSlotId, cancellationToken);

    public Task<ReplacementSlot?> GetReplacementSlotForPlacementForUpdateAsync(
        Guid replacementSlotId,
        CancellationToken cancellationToken = default)
        => GetReplacementSlotWithLockAsync(replacementSlotId, cancellationToken);

    private Task<ReplacementSlot?> GetReplacementSlotWithLockAsync(
        Guid replacementSlotId,
        CancellationToken cancellationToken)
    {
        if (string.Equals(
                _context.Database.ProviderName,
                "Npgsql.EntityFrameworkCore.PostgreSQL",
                StringComparison.Ordinal))
        {
            return _context.ReplacementSlots
                .FromSqlInterpolated($"SELECT * FROM public.replacement_slot WHERE replacement_slot_id = {replacementSlotId} FOR UPDATE")
                .AsTracking()
                .SingleOrDefaultAsync(cancellationToken);
        }

        // Unit tests use EF InMemory, which does not support relational row locks.
        return _context.ReplacementSlots
            .FirstOrDefaultAsync(s => s.ReplacementSlotId == replacementSlotId, cancellationToken);
    }

    public async Task<IReadOnlyList<Guid>> GetExpiredReplacementSlotIdsAsync(DateTime now, int take, CancellationToken cancellationToken = default) =>
        await _context.ReplacementSlots.AsNoTracking()
            .Where(s => s.Status == ReplacementSlotStates.Open && s.ExpiresAt != null && s.ExpiresAt <= now)
            .OrderBy(s => s.ExpiresAt)
            .Take(take)
            .Select(s => s.ReplacementSlotId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ReplacementSlot>> GetReplacementSlotsByJobAsync(Guid jobId, CancellationToken cancellationToken = default) =>
        await _context.ReplacementSlots.AsNoTracking()
            .Include(s => s.OriginalPlacement).ThenInclude(p => p.Application).ThenInclude(a => a.Candidate)
            .Include(s => s.FilledByPlacement!).ThenInclude(p => p.Application).ThenInclude(a => a.Candidate)
            .Where(s => s.JobId == jobId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<Guid?> GetJobCompanyIdAsync(Guid jobId, CancellationToken cancellationToken = default) =>
        _context.Jobs.AsNoTracking().Where(j => j.JobId == jobId).Select(j => (Guid?)j.CompanyId).FirstOrDefaultAsync(cancellationToken);

    public Task<Placement?> GetPlacementForFinanceAsync(Guid placementId, CancellationToken cancellationToken = default) =>
        _context.Placements
            .Include(p => p.Application).ThenInclude(a => a.Job)
            .Include(p => p.Offer)
            .Include(p => p.Warranty)
            .Include(p => p.ServiceFee)
            .Include(p => p.Commissions)
            .FirstOrDefaultAsync(p => p.PlacementId == placementId, cancellationToken);

    public async Task<Guid?> GetAffiliateUserIdAsync(Guid attributionId, CancellationToken cancellationToken = default) =>
        await _context.Attributions.AsNoTracking()
            .Where(a => a.AttributionId == attributionId)
            .Select(a => (Guid?)a.Affiliate.UserId)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<ServiceFee?> GetServiceFeeForUpdateAsync(Guid serviceFeeId, CancellationToken cancellationToken = default) =>
        _context.ServiceFees
            .Include(fee => fee.Placement!).ThenInclude(placement => placement.Reconciliation)
            .FirstOrDefaultAsync(fee => fee.ServiceFeeId == serviceFeeId, cancellationToken);

    public Task<Commission?> GetCommissionForUpdateAsync(Guid commissionId, CancellationToken cancellationToken = default) =>
        _context.Commissions
            .Include(c => c.Placement!).ThenInclude(p => p.ServiceFee)
            .Include(c => c.SourcingDelivery!).ThenInclude(d => d.Job)
            .Include(c => c.Payouts)
            .FirstOrDefaultAsync(c => c.CommissionId == commissionId, cancellationToken);

    public Task<Job?> GetJobForFinanceAsync(Guid jobId, CancellationToken cancellationToken = default) =>
        _context.Jobs
            .Include(j => j.ServiceType)
            .FirstOrDefaultAsync(j => j.JobId == jobId, cancellationToken);

    public async Task<IReadOnlyList<ServiceFee>> GetJobServiceFeesForUpdateAsync(Guid jobId, CancellationToken cancellationToken = default) =>
        await _context.ServiceFees
            .Where(fee => fee.JobId == jobId)
            .OrderBy(fee => fee.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetSourcingJobIdsAwaitingDepositAsync(int take, CancellationToken cancellationToken = default) =>
        await _context.Jobs.AsNoTracking()
            .Where(j => j.ServiceType.Code == ServiceTypeCvSourcing
                        && j.AgreedAt != null
                        && j.DepositPercent > 0
                        && !_context.ServiceFees.Any(fee => fee.JobId == j.JobId && fee.Kind == ServiceFeeKinds.Deposit))
            .OrderBy(j => j.AgreedAt)
            .Take(take)
            .Select(j => j.JobId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetClosedSourcingJobIdsAwaitingSettlementAsync(int take, CancellationToken cancellationToken = default) =>
        await _context.Jobs.AsNoTracking()
            .Where(j => j.ServiceType.Code == ServiceTypeCvSourcing
                        && j.Status == ClosedJob
                        && j.AgreedAt != null
                        && (_context.ServiceFees.Any(fee => fee.JobId == j.JobId && fee.Kind == ServiceFeeKinds.Deposit)
                            || _context.SourcingDeliveries.Any(d => d.JobId == j.JobId
                                && (d.Status == SourcingDeliveryStates.Accepted || d.Status == SourcingDeliveryStates.AutoAccepted)))
                        && !_context.ServiceFees.Any(fee => fee.JobId == j.JobId
                            && (fee.Kind == ServiceFeeKinds.Settlement || fee.Kind == ServiceFeeKinds.Credit)))
            .OrderBy(j => j.UpdatedAt)
            .Take(take)
            .Select(j => j.JobId)
            .ToListAsync(cancellationToken);

    public Task<bool> HasSourcingCommissionAsync(Guid deliveryId, CancellationToken cancellationToken = default) =>
        _context.Commissions.AnyAsync(c => c.SourcingDeliveryId == deliveryId, cancellationToken);

    public async Task<bool> HasActiveDisputeAsync(
        Guid commissionId,
        Guid attributionId,
        CancellationToken cancellationToken = default)
    {
        if (await _context.Disputes.AnyAsync(d =>
                DisputeStates.Active.Contains(d.Status) &&
                (d.CommissionId == commissionId || d.AttributionId == attributionId), cancellationToken))
        {
            return true;
        }

        return await _context.CandidateDuplicateCases.AnyAsync(duplicateCase =>
            (duplicateCase.Status == "OPEN" ||
             duplicateCase.Status == "AWAITING_CANDIDATE" ||
             duplicateCase.Status == "UNDER_REVIEW" ||
             duplicateCase.Status == "BLOCKED_FINANCE") &&
            _context.Attributions.Any(attribution =>
                attribution.AttributionId == attributionId &&
                (attribution.Application.CandidateId == duplicateCase.CandidateAId ||
                 attribution.Application.CandidateId == duplicateCase.CandidateBId) &&
                (duplicateCase.JobId == null || duplicateCase.JobId == attribution.Application.JobId)),
            cancellationToken);
    }

    public async Task<IReadOnlyList<Commission>> GetCommissionsOfSuspendedAffiliatesAsync(int take, CancellationToken cancellationToken = default) =>
        await _context.Commissions
            .Where(c => (c.Status == CommissionStates.Pending || c.Status == CommissionStates.InWarranty)
                        && c.Attribution.Affiliate.User.Status == SuspendedUser)
            .OrderBy(c => c.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Commission>> GetHeldCommissionsOfReactivatedAffiliatesAsync(int take, CancellationToken cancellationToken = default) =>
        await _context.Commissions
            .Include(c => c.Placement!).ThenInclude(p => p.Warranty)
            .Where(c => c.Status == CommissionStates.OnHold
                        && c.Attribution.Affiliate.User.Status == ActiveUser
                        && c.Placement != null
                        && c.Placement.Warranty != null
                        && (c.Placement.Warranty.Status == WarrantyStates.Active || c.Placement.Warranty.Status == WarrantyStates.Passed))
            .OrderBy(c => c.UpdatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetPlacementIdsWithWarrantyEndingAsync(DateOnly onOrBefore, int take, CancellationToken cancellationToken = default) =>
        await _context.Warranties.AsNoTracking()
            .Where(w => w.Status == WarrantyStates.Active && w.EndDate != null && w.EndDate <= onOrBefore)
            .OrderBy(w => w.EndDate)
            .Take(take)
            .Select(w => w.PlacementId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetServiceFeeIdsDueSoonAsync(DateOnly today, DateOnly dueOnOrBefore, int take, CancellationToken cancellationToken = default) =>
        await _context.ServiceFees.AsNoTracking()
            .Where(fee => fee.Status == ServiceFeeStates.Pending && fee.DueDate >= today && fee.DueDate <= dueOnOrBefore)
            .OrderBy(fee => fee.DueDate)
            .Take(take)
            .Select(fee => fee.ServiceFeeId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetActiveCompanyUserIdsAsync(Guid companyId, CancellationToken cancellationToken = default) =>
        await _context.CompanyUsers.AsNoTracking()
            .Where(cu => cu.CompanyId == companyId && cu.Status == "ACTIVE")
            .Select(cu => cu.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetOverdueServiceFeeIdsAsync(DateOnly dueBefore, int take, CancellationToken cancellationToken = default) =>
        await _context.ServiceFees.AsNoTracking()
            .Where(fee => (fee.Status == ServiceFeeStates.Pending || fee.Status == ServiceFeeStates.Due) && fee.DueDate < dueBefore)
            .OrderBy(fee => fee.DueDate)
            .Take(take)
            .Select(fee => fee.ServiceFeeId)
            .ToListAsync(cancellationToken);

    public async Task<(IReadOnlyList<ServiceFee> Items, int TotalCount)> GetServiceFeesAsync(
        Guid? companyId, string? status, int page, int pageSize, CancellationToken cancellationToken = default,
        Guid? jobId = null, string? kind = null)
    {
        var query = _context.ServiceFees.AsNoTracking();
        if (companyId.HasValue)
        {
            query = query.Where(fee => fee.CompanyId == companyId.Value);
        }

        if (status != null)
        {
            query = query.Where(fee => fee.Status == status);
        }

        if (jobId.HasValue)
        {
            query = query.Where(fee => fee.JobId == jobId.Value
                || (fee.Placement != null && fee.Placement.Application.JobId == jobId.Value));
        }

        if (kind != null)
        {
            query = query.Where(fee => fee.Kind == kind);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(fee => fee.Company)
            .Include(fee => fee.Job)
            .Include(fee => fee.Placement!).ThenInclude(p => p.Application).ThenInclude(a => a.Job)
            .Include(fee => fee.Placement!).ThenInclude(p => p.Application).ThenInclude(a => a.Candidate)
            .Include(fee => fee.Placement!).ThenInclude(p => p.Reconciliation)
            // Newest activity first: a fee paid today sorts above one raised last week.
            .OrderByDescending(fee => fee.PaidAt ?? fee.CreatedAt)
            .ThenByDescending(fee => fee.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, total);
    }

    public async Task<(IReadOnlyList<Commission> Items, int TotalCount)> GetCommissionsAsync(
        Guid? affiliateUserId, string? status, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _context.Commissions.AsNoTracking();
        if (affiliateUserId.HasValue)
        {
            query = query.Where(c => c.Attribution.Affiliate.UserId == affiliateUserId.Value);
        }

        if (status != null)
        {
            query = query.Where(c => c.Status == status);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(c => c.Attribution).ThenInclude(a => a.Affiliate).ThenInclude(a => a.User)
            .Include(c => c.Placement!).ThenInclude(p => p.Application).ThenInclude(a => a.Job)
            .Include(c => c.Placement!).ThenInclude(p => p.Application).ThenInclude(a => a.Candidate)
            .Include(c => c.Placement!).ThenInclude(p => p.Warranty)
            .Include(c => c.Placement!).ThenInclude(p => p.ServiceFee)
            .Include(c => c.SourcingDelivery!).ThenInclude(d => d.Job)
            .Include(c => c.SourcingDelivery!).ThenInclude(d => d.Application).ThenInclude(a => a.Candidate)
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, total);
    }

    public async Task<(IReadOnlyList<Warranty> Items, int TotalCount)> GetWarrantiesAsync(
        Guid? companyId, string? status, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _context.Warranties.AsNoTracking();
        if (companyId.HasValue)
        {
            query = query.Where(w => w.Placement.Application.Job.CompanyId == companyId.Value);
        }

        if (status != null)
        {
            query = query.Where(w => w.Status == status);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(w => w.Placement).ThenInclude(p => p.Application).ThenInclude(a => a.Job).ThenInclude(j => j.Company)
            .Include(w => w.Placement).ThenInclude(p => p.Application).ThenInclude(a => a.Candidate)
            .Include(w => w.Placement).ThenInclude(p => p.ServiceFee)
            .Include(w => w.Placement).ThenInclude(p => p.Commissions)
            // Claims waiting for verification first, then the nearest end dates.
            .OrderBy(w => w.Status == "CLAIMED" ? 0 : 1)
            .ThenBy(w => w.EndDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, total);
    }

    public async Task<(IReadOnlyList<Payout> Items, int TotalCount)> GetPayoutsAsync(
        Guid? affiliateUserId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _context.Payouts.AsNoTracking();
        if (affiliateUserId.HasValue)
        {
            query = query.Where(p => p.Commission.Attribution.Affiliate.UserId == affiliateUserId.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(p => p.Commission).ThenInclude(c => c.Attribution).ThenInclude(a => a.Affiliate).ThenInclude(a => a!.User)
            .Include(p => p.Commission).ThenInclude(c => c.Placement!).ThenInclude(pl => pl.Application).ThenInclude(a => a.Candidate)
            .Include(p => p.Commission).ThenInclude(c => c.Placement!).ThenInclude(pl => pl.Application).ThenInclude(a => a.Job)
            .Include(p => p.Commission).ThenInclude(c => c.SourcingDelivery!).ThenInclude(d => d.Job)
            .Include(p => p.Commission).ThenInclude(c => c.SourcingDelivery!).ThenInclude(d => d.Application).ThenInclude(a => a.Candidate)
            .AsSplitQuery()
            // Newest transfer first, by the date the money actually left.
            .OrderByDescending(p => p.PayoutDate ?? p.CreatedAt)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, total);
    }
}
