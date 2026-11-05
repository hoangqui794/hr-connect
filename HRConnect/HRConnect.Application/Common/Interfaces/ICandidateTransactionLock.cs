namespace HRConnect.Application.Common.Interfaces;

/// <summary>
/// Serializes candidate-wide recruitment decisions (offer acceptance and placement)
/// inside an active database transaction.
/// </summary>
public interface ICandidateTransactionLock
{
    Task AcquireAsync(Guid candidateId, CancellationToken cancellationToken = default);
}
