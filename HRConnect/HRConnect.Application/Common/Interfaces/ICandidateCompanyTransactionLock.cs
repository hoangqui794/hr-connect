namespace HRConnect.Application.Common.Interfaces;

/// <summary>
/// Serializes Application creation for one Candidate and Company inside the active database transaction.
/// </summary>
public interface ICandidateCompanyTransactionLock
{
    Task AcquireAsync(
        Guid candidateId,
        Guid companyId,
        CancellationToken cancellationToken = default);
}
