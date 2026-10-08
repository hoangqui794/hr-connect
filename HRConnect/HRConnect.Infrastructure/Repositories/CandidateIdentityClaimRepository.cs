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

    public async Task<(IReadOnlyList<AdminIdentityClaimListRecord> Items, int TotalCount)> GetAdminListAsync(
        string status,
        string? search,
        int page,
        int pageSize,
        string sortBy,
        bool descending,
        CancellationToken cancellationToken = default)
    {
        var query = context.CandidateIdentityClaims.AsNoTracking()
            .Where(claim => claim.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(claim =>
                claim.NormalizedEmail.Contains(term) ||
                claim.RequesterUser.Email.ToLower().Contains(term) ||
                (claim.RequesterUser.DisplayName ?? string.Empty).ToLower().Contains(term) ||
                claim.RequesterCandidate.FullName.ToLower().Contains(term) ||
                (claim.TargetCandidate != null &&
                 claim.TargetCandidate.FullName.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        query = (sortBy, descending) switch
        {
            ("verifiedAt", true) => query.OrderByDescending(claim => claim.VerifiedAt)
                .ThenByDescending(claim => claim.CreatedAt),
            ("verifiedAt", false) => query.OrderBy(claim => claim.VerifiedAt)
                .ThenBy(claim => claim.CreatedAt),
            ("reviewedAt", true) => query.OrderByDescending(claim => claim.ReviewedAt)
                .ThenByDescending(claim => claim.CreatedAt),
            ("reviewedAt", false) => query.OrderBy(claim => claim.ReviewedAt)
                .ThenBy(claim => claim.CreatedAt),
            ("createdAt", false) => query.OrderBy(claim => claim.CreatedAt),
            _ => query.OrderByDescending(claim => claim.CreatedAt)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(claim => new AdminIdentityClaimListRecord(
                claim.ClaimId,
                claim.RequesterUserId,
                claim.RequesterCandidateId,
                claim.TargetCandidateId,
                claim.NormalizedEmail,
                claim.Status,
                claim.ReviewReason,
                claim.RequesterUser.DisplayName ?? claim.RequesterUser.Email,
                claim.RequesterUser.Email,
                claim.RequesterCandidate.FullName,
                claim.TargetCandidate == null ? null : claim.TargetCandidate.FullName,
                claim.CreatedAt,
                claim.VerifiedAt,
                claim.ReviewedAt,
                claim.ReviewedBy))
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

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

    public Task<bool> TryRotateOtpAsync(
        Guid claimId,
        Guid requesterUserId,
        Guid expectedConcurrencyToken,
        Guid newConcurrencyToken,
        string newTokenHash,
        DateTime now,
        DateTime expiresAt,
        DateTime cooldownCutoff,
        int maxResends,
        CancellationToken cancellationToken = default) =>
        ExecuteAndCheckAsync(context.CandidateIdentityClaims
            .Where(claim => claim.ClaimId == claimId &&
                            claim.RequesterUserId == requesterUserId &&
                            claim.Status == "PENDING_VERIFICATION" &&
                            claim.ExpiresAt > now &&
                            claim.ResendCount < maxResends &&
                            (claim.LastSentAt == null || claim.LastSentAt <= cooldownCutoff) &&
                            claim.ConcurrencyToken == expectedConcurrencyToken)
            .ExecuteUpdateAsync(update => update
                .SetProperty(claim => claim.TokenHash, newTokenHash)
                .SetProperty(claim => claim.ExpiresAt, expiresAt)
                .SetProperty(claim => claim.AttemptCount, 0)
                .SetProperty(claim => claim.ResendCount, claim => claim.ResendCount + 1)
                .SetProperty(claim => claim.LastSentAt, now)
                .SetProperty(claim => claim.UpdatedAt, now)
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
