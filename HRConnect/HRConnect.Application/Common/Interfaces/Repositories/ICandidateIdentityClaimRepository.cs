using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICandidateIdentityClaimRepository
{
    Task<CandidateIdentityClaim?> GetByIdAsync(
        Guid claimId,
        CancellationToken cancellationToken = default);

    Task<CandidateIdentityClaim?> GetActiveByRequesterAndEmailAsync(
        Guid requesterUserId,
        string normalizedEmail,
        CancellationToken cancellationToken = default);

    Task AddAsync(
        CandidateIdentityClaim claim,
        CancellationToken cancellationToken = default);

    void Update(CandidateIdentityClaim claim);
}
