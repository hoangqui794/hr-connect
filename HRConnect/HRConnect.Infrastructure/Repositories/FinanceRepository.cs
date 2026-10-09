using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class FinanceRepository : IFinanceRepository
{
    private const string ActiveAttribution = "ACTIVE";

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

    public Task<Placement?> GetPlacementForFinanceAsync(Guid placementId, CancellationToken cancellationToken = default) =>
        _context.Placements
            .Include(p => p.Application).ThenInclude(a => a.Job)
            .Include(p => p.Warranty)
            .Include(p => p.ServiceFee)
            .Include(p => p.Commissions)
            .FirstOrDefaultAsync(p => p.PlacementId == placementId, cancellationToken);

    public Task<ServiceFee?> GetServiceFeeForUpdateAsync(Guid serviceFeeId, CancellationToken cancellationToken = default) =>
        _context.ServiceFees.FirstOrDefaultAsync(fee => fee.ServiceFeeId == serviceFeeId, cancellationToken);

    public Task<Commission?> GetCommissionForUpdateAsync(Guid commissionId, CancellationToken cancellationToken = default) =>
        _context.Commissions
            .Include(c => c.Placement).ThenInclude(p => p.ServiceFee)
            .Include(c => c.Payouts)
            .FirstOrDefaultAsync(c => c.CommissionId == commissionId, cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetPlacementIdsWithWarrantyEndingAsync(DateOnly onOrBefore, int take, CancellationToken cancellationToken = default) =>
        await _context.Warranties.AsNoTracking()
            .Where(w => w.Status == WarrantyStates.Active && w.EndDate != null && w.EndDate <= onOrBefore)
            .OrderBy(w => w.EndDate)
            .Take(take)
            .Select(w => w.PlacementId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetOverdueServiceFeeIdsAsync(DateOnly dueBefore, int take, CancellationToken cancellationToken = default) =>
        await _context.ServiceFees.AsNoTracking()
            .Where(fee => fee.Status == ServiceFeeStates.Pending && fee.DueDate < dueBefore)
            .OrderBy(fee => fee.DueDate)
            .Take(take)
            .Select(fee => fee.ServiceFeeId)
            .ToListAsync(cancellationToken);

    public async Task<(IReadOnlyList<ServiceFee> Items, int TotalCount)> GetServiceFeesAsync(
        Guid? companyId, string? status, int page, int pageSize, CancellationToken cancellationToken = default)
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

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(fee => fee.Company)
            .Include(fee => fee.Placement).ThenInclude(p => p.Application).ThenInclude(a => a.Job)
            .Include(fee => fee.Placement).ThenInclude(p => p.Application).ThenInclude(a => a.Candidate)
            .OrderByDescending(fee => fee.CreatedAt)
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
            .Include(c => c.Placement).ThenInclude(p => p.Application).ThenInclude(a => a.Job)
            .Include(c => c.Placement).ThenInclude(p => p.Application).ThenInclude(a => a.Candidate)
            .Include(c => c.Placement).ThenInclude(p => p.Warranty)
            .Include(c => c.Placement).ThenInclude(p => p.ServiceFee)
            .OrderByDescending(c => c.CreatedAt)
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
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, total);
    }
}
