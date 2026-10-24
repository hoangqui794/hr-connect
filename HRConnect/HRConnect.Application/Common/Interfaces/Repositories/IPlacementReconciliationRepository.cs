using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IPlacementReconciliationRepository
{
    Task AddAsync(PlacementReconciliation reconciliation, CancellationToken cancellationToken = default);
    Task<PlacementReconciliation?> GetByApplicationIdAsync(Guid applicationId, bool tracking = true, CancellationToken cancellationToken = default);
    Task<PlacementReconciliation?> GetByServiceFeeIdAsync(Guid serviceFeeId, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<PlacementReconciliation> Items, int TotalCount)> GetPageAsync(
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Guid>> GetActivePlatformAdminUserIdsAsync(CancellationToken cancellationToken = default);
    Task<Guid?> GetAttributedAffiliateUserIdAsync(Guid applicationId, CancellationToken cancellationToken = default);
}
