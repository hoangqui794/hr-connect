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

    /// <summary>Puts a PROCESSING payment back to PENDING after an unexpected error, so VNPay's next IPN retry can apply it.</summary>
    Task ReleaseClaimAsync(Guid onlinePaymentId, CancellationToken cancellationToken = default);
}
