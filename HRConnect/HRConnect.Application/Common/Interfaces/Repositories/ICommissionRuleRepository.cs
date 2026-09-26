using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICommissionRuleRepository
{
    Task<bool> ExistsActiveAtEffectiveFromAsync(
        Guid serviceTypeId,
        string milestoneType,
        DateTime effectiveFrom,
        CancellationToken cancellationToken = default);

    Task AddAsync(CommissionRule commissionRule, CancellationToken cancellationToken = default);
}
