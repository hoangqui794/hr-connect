using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class CandidateIdentityClaimRepository(ApplicationDbContext context)
    : ICandidateIdentityClaimRepository
{
    private static readonly string[] ActiveStatuses =
    [
        "PENDING_VERIFICATION",
        "VERIFIED",
        "PENDING_ADMIN_REVIEW"
    ];

    public Task<CandidateIdentityClaim?> GetByIdAsync(
        Guid claimId,
        CancellationToken cancellationToken = default) =>
        context.CandidateIdentityClaims.SingleOrDefaultAsync(
            claim => claim.ClaimId == claimId,
            cancellationToken);

    public Task<CandidateIdentityClaim?> GetActiveByRequesterAndEmailAsync(
        Guid requesterUserId,
        string normalizedEmail,
        CancellationToken cancellationToken = default) =>
        context.CandidateIdentityClaims.AsNoTracking().SingleOrDefaultAsync(
            claim => claim.RequesterUserId == requesterUserId &&
                     claim.NormalizedEmail == normalizedEmail &&
                     ActiveStatuses.Contains(claim.Status),
            cancellationToken);

    public Task AddAsync(
        CandidateIdentityClaim claim,
        CancellationToken cancellationToken = default) =>
        context.CandidateIdentityClaims.AddAsync(claim, cancellationToken).AsTask();

    public void Update(CandidateIdentityClaim claim) =>
        context.CandidateIdentityClaims.Update(claim);

    public Task<bool> TryMarkVerifiedAsync(
        Guid claimId,
        Guid requesterUserId,
        Guid expectedConcurrencyToken,
        Guid newConcurrencyToken,
        DateTime verifiedAt,
        CancellationToken cancellationToken = default) =>
        ExecuteAndCheckAsync(context.CandidateIdentityClaims
            .Where(claim => claim.ClaimId == claimId &&
                            claim.RequesterUserId == requesterUserId &&
                            claim.Status == "PENDING_VERIFICATION" &&
                            claim.ExpiresAt > verifiedAt &&
                            claim.AttemptCount < 5 &&
                            claim.ConcurrencyToken == expectedConcurrencyToken)
            .ExecuteUpdateAsync(update => update
                .SetProperty(claim => claim.Status, "VERIFIED")
                .SetProperty(claim => claim.VerifiedAt, verifiedAt)
                .SetProperty(claim => claim.UpdatedAt, verifiedAt)
                .SetProperty(claim => claim.ConcurrencyToken, newConcurrencyToken), cancellationToken));

    public Task<bool> TryRecordFailedAttemptAsync(
        Guid claimId,
        Guid requesterUserId,
        Guid expectedConcurrencyToken,
        Guid newConcurrencyToken,
        bool closeClaim,
        DateTime updatedAt,
        CancellationToken cancellationToken = default) =>
        ExecuteAndCheckAsync(context.CandidateIdentityClaims
            .Where(claim => claim.ClaimId == claimId &&
                            claim.RequesterUserId == requesterUserId &&
                            claim.Status == "PENDING_VERIFICATION" &&
                            claim.ConcurrencyToken == expectedConcurrencyToken)
            .ExecuteUpdateAsync(update => update
                .SetProperty(claim => claim.AttemptCount, claim => claim.AttemptCount + 1)
                .SetProperty(claim => claim.Status, closeClaim ? "CANCELLED" : "PENDING_VERIFICATION")
                .SetProperty(claim => claim.CompletedAt, closeClaim ? updatedAt : (DateTime?)null)
                .SetProperty(claim => claim.UpdatedAt, updatedAt)
                .SetProperty(claim => claim.ConcurrencyToken, newConcurrencyToken), cancellationToken));

    public Task<bool> TryCompleteAsync(
        Guid claimId,
        Guid requesterUserId,
        Guid expectedConcurrencyToken,
        string status,
        Guid newConcurrencyToken,
        DateTime completedAt,
        string? reviewReason,
        CancellationToken cancellationToken = default) =>
        ExecuteAndCheckAsync(context.CandidateIdentityClaims
            .Where(claim => claim.ClaimId == claimId &&
                            claim.RequesterUserId == requesterUserId &&
                            claim.Status == "VERIFIED" &&
                            claim.ConcurrencyToken == expectedConcurrencyToken)
            .ExecuteUpdateAsync(update => update
                .SetProperty(claim => claim.Status, status)
                .SetProperty(claim => claim.CompletedAt, completedAt)
                .SetProperty(claim => claim.ReviewReason, reviewReason)
                .SetProperty(claim => claim.UpdatedAt, completedAt)
                .SetProperty(claim => claim.ConcurrencyToken, newConcurrencyToken), cancellationToken));

    private static async Task<bool> ExecuteAndCheckAsync(Task<int> update) =>
        await update == 1;
}
