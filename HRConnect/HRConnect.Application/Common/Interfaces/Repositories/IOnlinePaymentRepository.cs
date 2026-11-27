using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IOnlinePaymentRepository
{
    Task AddAsync(OnlinePayment payment, CancellationToken cancellationToken = default);

    /// <summary>The newest payment attempt that can still own this payable target.</summary>
    Task<OnlinePayment?> GetActiveByTargetAsync(
        string targetType, Guid targetId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically inserts and saves a PENDING payment. False means another request already created
    /// an active PENDING/PROCESSING payment for the same target.
    /// </summary>
    Task<bool> TryAddPendingAsync(OnlinePayment payment, CancellationToken cancellationToken = default);

    Task<OnlinePayment?> GetByTxnRefAsync(string txnRef, CancellationToken cancellationToken = default);

    /// <summary>Moves a PENDING payment to PROCESSING in one statement; false when another callback got there first.</summary>
    Task<bool> TryClaimAsync(
        Guid onlinePaymentId, DateTime now, DateTime processingStaleBefore,
        CancellationToken cancellationToken = default);

    /// <summary>The status saved in the database right now (not the tracked copy); null when the payment does not exist.</summary>
    Task<string?> GetCurrentStatusAsync(Guid onlinePaymentId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Moves a FAILED payment (expired or replaced by a newer link) to PROCESSING in one statement, so VNPay's
    /// late success callback can still be applied. False when it is no longer FAILED or when a newer
    /// PENDING/PROCESSING payment already owns the same target.
    /// </summary>
    Task<bool> TryReclaimFailedAsync(Guid onlinePaymentId, DateTime now, CancellationToken cancellationToken = default);

    /// <summary>
    /// Moves a FAILED payment to NEEDS_REVIEW together with VNPay's transaction details in one statement;
    /// false when it is no longer FAILED.
    /// </summary>
    Task<bool> TryMarkFailedForReviewAsync(
        Guid onlinePaymentId, OnlinePaymentReviewDetails details, DateTime now, CancellationToken cancellationToken = default);

    /// <summary>Puts a PROCESSING payment back to PENDING after an unexpected error, so VNPay's next IPN retry can apply it.</summary>
    Task ReleaseClaimAsync(Guid onlinePaymentId, CancellationToken cancellationToken = default);

    /// <summary>Re-attaches a detached OnlinePayment after an inner transaction rollback so terminal status still saves.</summary>
    void Update(OnlinePayment payment) { }

    /// <summary>Returns active (PROCESSING or unexpired PENDING) status per target id for UI double-pay prevention.</summary>
    Task<IReadOnlyDictionary<Guid, string>> GetActiveStatusesByTargetIdsAsync(
        string targetType,
        IReadOnlyCollection<Guid> targetIds,
        DateTime pendingCreatedAfter,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyDictionary<Guid, string>>(new Dictionary<Guid, string>());
}

/// <summary>What VNPay reported for a payment that is kept for Platform Admin review.</summary>
public sealed record OnlinePaymentReviewDetails(
    string? ResponseCode, string? ProviderTransactionNo, string? BankCode, DateTime? PaidAt, string LastError);
