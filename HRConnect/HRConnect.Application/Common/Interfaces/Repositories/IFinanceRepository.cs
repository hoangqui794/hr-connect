using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

/// <summary>MF-05 persistence: service fees, warranties, commissions, payouts.</summary>
public interface IFinanceRepository
{
    Task<CommissionRule?> GetActiveCommissionRuleAsync(Guid serviceTypeId, DateTime at, CancellationToken cancellationToken = default);

    Task<Attribution?> GetActiveAttributionAsync(Guid applicationId, CancellationToken cancellationToken = default);

    Task AddWarrantyAsync(Warranty warranty, CancellationToken cancellationToken = default);

    Task AddServiceFeeAsync(ServiceFee serviceFee, CancellationToken cancellationToken = default);

    Task AddCommissionAsync(Commission commission, CancellationToken cancellationToken = default);

    Task AddCommissionAdjustmentAsync(CommissionAdjustment adjustment, CancellationToken cancellationToken = default);

    Task AddPayoutAsync(Payout payout, CancellationToken cancellationToken = default);

    /// <summary>Placement with job, warranty, service fee and commissions, tracked for update.</summary>
    Task<Placement?> GetPlacementForFinanceAsync(Guid placementId, CancellationToken cancellationToken = default);

    Task<ServiceFee?> GetServiceFeeForUpdateAsync(Guid serviceFeeId, CancellationToken cancellationToken = default);

    /// <summary>Commission with its placement's service fee, attribution and payouts, tracked for update.</summary>
    Task<Commission?> GetCommissionForUpdateAsync(Guid commissionId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetPlacementIdsWithWarrantyEndingAsync(DateOnly onOrBefore, int take, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetOverdueServiceFeeIdsAsync(DateOnly dueBefore, int take, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<ServiceFee> Items, int TotalCount)> GetServiceFeesAsync(
        Guid? companyId, string? status, int page, int pageSize, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<Commission> Items, int TotalCount)> GetCommissionsAsync(
        Guid? affiliateUserId, string? status, int page, int pageSize, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<Payout> Items, int TotalCount)> GetPayoutsAsync(
        Guid? affiliateUserId, int page, int pageSize, CancellationToken cancellationToken = default);
}
