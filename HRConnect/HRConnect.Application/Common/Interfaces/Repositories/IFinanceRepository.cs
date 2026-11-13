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

    /// <summary>The affiliate's user id behind an attribution, for notifications.</summary>
    Task<Guid?> GetAffiliateUserIdAsync(Guid attributionId, CancellationToken cancellationToken = default);

    Task<ServiceFee?> GetServiceFeeForUpdateAsync(Guid serviceFeeId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Commission with its placement's service fee (HEADHUNT_COD) or its sourcing delivery and job
    /// (CV_SOURCING), and its payouts, tracked for update.
    /// </summary>
    Task<Commission?> GetCommissionForUpdateAsync(Guid commissionId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetPlacementIdsWithWarrantyEndingAsync(DateOnly onOrBefore, int take, CancellationToken cancellationToken = default);

    /// <summary>PENDING fees due between today and <paramref name="dueOnOrBefore"/> (inclusive): time to remind the Client.</summary>
    Task<IReadOnlyList<Guid>> GetServiceFeeIdsDueSoonAsync(DateOnly today, DateOnly dueOnOrBefore, int take, CancellationToken cancellationToken = default);

    /// <summary>User ids of the company's ACTIVE members, for payment reminders.</summary>
    Task<IReadOnlyList<Guid>> GetActiveCompanyUserIdsAsync(Guid companyId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetOverdueServiceFeeIdsAsync(DateOnly dueBefore, int take, CancellationToken cancellationToken = default);

    // ---- replacement slots (docs/main-flows.md (MF-05, suất thay thế)) ----

    Task AddReplacementSlotAsync(ReplacementSlot slot, CancellationToken cancellationToken = default);

    /// <summary>
    /// Earliest usable replacement slot for a job. Multiple submissions may point to the same
    /// slot; the slot is only filled when a replacement placement starts work.
    /// </summary>
    Task<ReplacementSlot?> GetEarliestOpenReplacementSlotForJobAsync(
        Guid jobId,
        DateTime now,
        CancellationToken cancellationToken = default);

    /// <summary>The slot granted under a service fee, with its job, tracked for update.</summary>
    Task<ReplacementSlot?> GetReplacementSlotByServiceFeeForUpdateAsync(Guid serviceFeeId, CancellationToken cancellationToken = default);

    /// <summary>Expired replacement slots of these jobs, with the candidate who left and the fee the refund is a share of (read only).</summary>
    Task<IReadOnlyList<ReplacementSlot>> GetExpiredReplacementSlotsForJobsAsync(IReadOnlyCollection<Guid> jobIds, CancellationToken cancellationToken = default);

    /// <summary>Slot with its job, tracked for update.</summary>
    Task<ReplacementSlot?> GetReplacementSlotForUpdateAsync(Guid replacementSlotId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Locks one slot row for the current transaction while MF-02 confirms Candidate consent.
    /// The caller must begin a transaction before invoking this method.
    /// </summary>
    Task<ReplacementSlot?> GetReplacementSlotForConsentForUpdateAsync(
        Guid replacementSlotId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Locks one slot row while MF-04 confirms that a replacement candidate started work.
    /// The caller must begin a transaction before invoking this method.
    /// </summary>
    Task<ReplacementSlot?> GetReplacementSlotForPlacementForUpdateAsync(
        Guid replacementSlotId,
        CancellationToken cancellationToken = default);

    /// <summary>OPEN slots whose deadline is at or before <paramref name="now"/>.</summary>
    Task<IReadOnlyList<Guid>> GetExpiredReplacementSlotIdsAsync(DateTime now, int take, CancellationToken cancellationToken = default);

    /// <summary>True when a candidate of this slot has reached the Client (same rule as what the Client can see).</summary>
    Task<bool> HasReplacementCandidateReachedClientAsync(Guid replacementSlotId, CancellationToken cancellationToken = default);

    /// <summary>The job's slots with leaver and replacement candidate names (read-only), newest first.</summary>
    Task<IReadOnlyList<ReplacementSlot>> GetReplacementSlotsByJobAsync(Guid jobId, CancellationToken cancellationToken = default);

    /// <summary>
    /// One company's open money and commitments for the Client dashboard: unpaid fees it owes
    /// (PLACEMENT, DEPOSIT, SETTLEMENT), refunds/credits owed to it, delivered sourcing CVs awaiting its
    /// answer, ACTIVE warranties ending between today and <paramref name="warrantyUntil"/>, and OPEN or
    /// WAITING_PAYMENT replacement slots.
    /// </summary>
    Task<HRConnect.Application.Features.Finance.Queries.ClientDashboardSnapshot> GetClientDashboardSnapshotAsync(
        Guid companyId, DateOnly today, DateOnly warrantyUntil, CancellationToken cancellationToken = default);

    /// <summary>
    /// Slots across jobs, paged, with job/company and candidate names loaded. <paramref name="companyId"/>
    /// limits to one company (Client caller). Ordered OPEN, WAITING_PAYMENT, FILLED, EXPIRED, CANCELLED, newest first.
    /// </summary>
    Task<(IReadOnlyList<ReplacementSlot> Items, int TotalCount)> GetReplacementSlotsAsync(
        Guid? companyId, Guid? jobId, string? status, int page, int pageSize, CancellationToken cancellationToken = default);

    Task<Guid?> GetJobCompanyIdAsync(Guid jobId, CancellationToken cancellationToken = default);

    // ---- CV_SOURCING deposit, settlement and per-CV commission (docs/MF05 section E8) ----

    /// <summary>Job with its service type, tracked.</summary>
    Task<Job?> GetJobForFinanceAsync(Guid jobId, CancellationToken cancellationToken = default);

    /// <summary>DEPOSIT, SETTLEMENT and CREDIT fees of a job, tracked for update.</summary>
    Task<IReadOnlyList<ServiceFee>> GetJobServiceFeesForUpdateAsync(Guid jobId, CancellationToken cancellationToken = default);

    /// <summary>DEPOSIT, SETTLEMENT and CREDIT fees of multiple jobs (read-only), for sourcing commission fee status.</summary>
    Task<IReadOnlyList<ServiceFee>> GetJobServiceFeesAsync(IReadOnlyCollection<Guid> jobIds, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ServiceFee>>(Array.Empty<ServiceFee>());

    /// <summary>Approved CV_SOURCING jobs with a deposit percent above zero and no DEPOSIT fee yet.</summary>
    Task<IReadOnlyList<Guid>> GetSourcingJobIdsAwaitingDepositAsync(int take, CancellationToken cancellationToken = default);

    /// <summary>CLOSED CV_SOURCING jobs that have been billed (deposit or counted CVs) but not settled.</summary>
    Task<IReadOnlyList<Guid>> GetClosedSourcingJobIdsAwaitingSettlementAsync(int take, CancellationToken cancellationToken = default);

    Task<bool> HasSourcingCommissionAsync(Guid deliveryId, CancellationToken cancellationToken = default);

    /// <summary>SF-04 D3: an OPEN / UNDER_REVIEW dispute targets this commission or its attribution.</summary>
    Task<bool> HasActiveDisputeAsync(Guid commissionId, Guid attributionId, CancellationToken cancellationToken = default);

    // ---- suspended affiliates (decision 2026-10-17) ----

    /// <summary>PENDING / IN_WARRANTY commissions of affiliates whose account is SUSPENDED, tracked for update.</summary>
    Task<IReadOnlyList<Commission>> GetCommissionsOfSuspendedAffiliatesAsync(int take, CancellationToken cancellationToken = default);

    /// <summary>
    /// ON_HOLD HEADHUNT_COD commissions of ACTIVE affiliates whose warranty is ACTIVE or PASSED (no resignation
    /// claim pending): held while the affiliate was suspended. Tracked, with the placement's warranty.
    /// </summary>
    Task<IReadOnlyList<Commission>> GetHeldCommissionsOfReactivatedAffiliatesAsync(int take, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<ServiceFee> Items, int TotalCount)> GetServiceFeesAsync(
        Guid? companyId, string? status, int page, int pageSize, CancellationToken cancellationToken = default,
        Guid? jobId = null, string? kind = null);

    Task<(IReadOnlyList<Commission> Items, int TotalCount)> GetCommissionsAsync(
        Guid? affiliateUserId, string? status, int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>Warranties with their placement, job, candidate, service fee and commissions (read-only).</summary>
    Task<(IReadOnlyList<Warranty> Items, int TotalCount)> GetWarrantiesAsync(
        Guid? companyId, string? status, int page, int pageSize, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<Payout> Items, int TotalCount)> GetPayoutsAsync(
        Guid? affiliateUserId, int page, int pageSize, CancellationToken cancellationToken = default);
}
