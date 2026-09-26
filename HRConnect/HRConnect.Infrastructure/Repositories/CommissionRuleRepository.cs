using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class CommissionRuleRepository : ICommissionRuleRepository
{
    private readonly ApplicationDbContext _context;

    public CommissionRuleRepository(ApplicationDbContext context) => _context = context;

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
