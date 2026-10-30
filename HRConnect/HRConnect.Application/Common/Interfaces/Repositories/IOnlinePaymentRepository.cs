using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IOnlinePaymentRepository
{
    Task AddAsync(OnlinePayment payment, CancellationToken cancellationToken = default);

    Task<OnlinePayment?> GetByTxnRefAsync(string txnRef, CancellationToken cancellationToken = default);

    /// <summary>Moves a PENDING payment to PROCESSING in one statement; false when another callback got there first.</summary>
    Task<bool> TryClaimAsync(Guid onlinePaymentId, DateTime now, CancellationToken cancellationToken = default);

    /// <summary>Puts a PROCESSING payment back to PENDING after an unexpected error, so VNPay's next IPN retry can apply it.</summary>
    Task ReleaseClaimAsync(Guid onlinePaymentId, CancellationToken cancellationToken = default);
}
