using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICommissionRuleRepository
{
    Task<(IReadOnlyList<CommissionRule> Items, int Total)> GetListAsync(
        Guid? serviceTypeId,
        string? milestoneType,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsActiveAtEffectiveFromAsync(
        Guid serviceTypeId,
        string milestoneType,
        DateTime effectiveFrom,
        CancellationToken cancellationToken = default);

    Task AddAsync(CommissionRule commissionRule, CancellationToken cancellationToken = default);
}
