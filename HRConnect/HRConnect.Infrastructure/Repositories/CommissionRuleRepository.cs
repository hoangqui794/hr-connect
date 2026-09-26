using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class CommissionRuleRepository : ICommissionRuleRepository
{
    private readonly ApplicationDbContext _context;

    public CommissionRuleRepository(ApplicationDbContext context) => _context = context;

    public async Task<(IReadOnlyList<CommissionRule> Items, int Total)> GetListAsync(
        Guid? serviceTypeId,
        string? milestoneType,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.CommissionRules.AsNoTracking().AsQueryable();

        if (serviceTypeId.HasValue)
        {
            query = query.Where(rule => rule.ServiceTypeId == serviceTypeId.Value);
        }

        if (!string.IsNullOrWhiteSpace(milestoneType))
        {
            var normalizedMilestoneType = milestoneType.Trim().ToUpperInvariant();
            query = query.Where(rule => rule.MilestoneType == normalizedMilestoneType);
        }

        if (isActive.HasValue)
        {
            query = query.Where(rule => rule.IsActive == isActive.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(rule => rule.ServiceType)
            .Include(rule => rule.MilestoneTypeNavigation)
            .OrderByDescending(rule => rule.IsActive)
            .ThenByDescending(rule => rule.EffectiveFrom)
            .ThenByDescending(rule => rule.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }

    public Task<bool> ExistsActiveAtEffectiveFromAsync(
        Guid serviceTypeId,
        string milestoneType,
        DateTime effectiveFrom,
        CancellationToken cancellationToken = default) =>
        _context.CommissionRules.AsNoTracking().AnyAsync(rule =>
            rule.ServiceTypeId == serviceTypeId &&
            rule.MilestoneType == milestoneType &&
            rule.EffectiveFrom == effectiveFrom &&
            rule.IsActive,
            cancellationToken);

    public Task AddAsync(CommissionRule commissionRule, CancellationToken cancellationToken = default) =>
        _context.CommissionRules.AddAsync(commissionRule, cancellationToken).AsTask();
}
