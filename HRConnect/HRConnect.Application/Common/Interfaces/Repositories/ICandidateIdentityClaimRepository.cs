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

    Task<bool> TryMarkVerifiedAsync(
        Guid claimId,
        Guid requesterUserId,
        Guid expectedConcurrencyToken,
        Guid newConcurrencyToken,
        DateTime verifiedAt,
        CancellationToken cancellationToken = default);

    Task<bool> TryRecordFailedAttemptAsync(
        Guid claimId,
        Guid requesterUserId,
        Guid expectedConcurrencyToken,
        Guid newConcurrencyToken,
        bool closeClaim,
        DateTime updatedAt,
        CancellationToken cancellationToken = default);

    Task<bool> TryRotateOtpAsync(
        Guid claimId,
        Guid requesterUserId,
        Guid expectedConcurrencyToken,
        Guid newConcurrencyToken,
        string newTokenHash,
        DateTime now,
        DateTime expiresAt,
        DateTime cooldownCutoff,
        int maxResends,
        CancellationToken cancellationToken = default);

    Task<bool> TryCompleteAsync(
        Guid claimId,
        Guid requesterUserId,
        Guid expectedConcurrencyToken,
        string status,
        Guid newConcurrencyToken,
        DateTime completedAt,
        string? reviewReason,
        CancellationToken cancellationToken = default);
}
