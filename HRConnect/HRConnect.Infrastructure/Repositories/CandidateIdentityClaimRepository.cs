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

    public async Task<AdminIdentityClaimDetailRecord?> GetAdminDetailAsync(
        Guid claimId,
        CancellationToken cancellationToken = default)
    {
        var detail = await context.CandidateIdentityClaims.AsNoTracking()
            .Where(claim => claim.ClaimId == claimId)
            .Select(claim => new AdminIdentityClaimDetailRecord(
                claim.ClaimId,
                claim.RequesterUserId,
                claim.RequesterUser.DisplayName ?? claim.RequesterUser.Email,
                claim.RequesterUser.Email,
                claim.RequesterUser.Status,
                claim.AssertedEmail,
                claim.NormalizedEmail,
                claim.Status,
                claim.ReviewReason,
                claim.ExpiresAt,
                claim.AttemptCount,
                claim.ResendCount,
                claim.LastSentAt,
                claim.VerifiedAt,
                claim.CompletedAt,
                claim.ReviewedBy,
                claim.ReviewedAt,
                claim.CreatedAt,
                claim.UpdatedAt,
                claim.ConcurrencyToken,
                new AdminIdentityClaimCandidateRecord(
                    claim.RequesterCandidate.CandidateId,
                    claim.RequesterCandidate.UserId,
                    claim.RequesterCandidate.FullName,
                    claim.RequesterCandidate.Email,
                    claim.RequesterCandidate.Phone,
                    claim.RequesterCandidate.Status,
                    claim.RequesterCandidate.MergedIntoCandidateId,
                    claim.RequesterCandidate.CandidateCvs.Count,
                    claim.RequesterCandidate.Submissions.Count,
                    claim.RequesterCandidate.Applications.Count,
                    claim.RequesterCandidate.CandidateJobMatches.Count),
                claim.TargetCandidate == null
                    ? null
                    : new AdminIdentityClaimCandidateRecord(
                        claim.TargetCandidate.CandidateId,
                        claim.TargetCandidate.UserId,
                        claim.TargetCandidate.FullName,
                        claim.TargetCandidate.Email,
                        claim.TargetCandidate.Phone,
                        claim.TargetCandidate.Status,
                        claim.TargetCandidate.MergedIntoCandidateId,
                        claim.TargetCandidate.CandidateCvs.Count,
                        claim.TargetCandidate.Submissions.Count,
                        claim.TargetCandidate.Applications.Count,
                        claim.TargetCandidate.CandidateJobMatches.Count),
                null))
            .SingleOrDefaultAsync(cancellationToken);

        if (detail == null) return null;

        var owner = await context.UserEmailIdentities.AsNoTracking()
            .Where(identity => identity.NormalizedEmail == detail.NormalizedEmail &&
                               identity.Status == "VERIFIED")
            .Select(identity => new AdminIdentityClaimEmailOwnerRecord(
                identity.EmailIdentityId,
                identity.UserId,
                identity.User.Email,
                identity.User.DisplayName ?? identity.User.Email,
                identity.Kind,
                identity.Status))
            .SingleOrDefaultAsync(cancellationToken);

        return detail with { CurrentEmailOwner = owner };
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

    public Task<bool> TryAdminResolveAsync(
        Guid claimId,
        Guid expectedConcurrencyToken,
        Guid newConcurrencyToken,
        Guid reviewedBy,
        string status,
        DateTime reviewedAt,
        string? reviewReason,
        CancellationToken cancellationToken = default) =>
        ExecuteAndCheckAsync(context.CandidateIdentityClaims
            .Where(claim => claim.ClaimId == claimId &&
                            claim.Status == "PENDING_ADMIN_REVIEW" &&
                            claim.ConcurrencyToken == expectedConcurrencyToken &&
                            (status != "COMPLETED" ||
                             context.UserEmailIdentities.Any(identity =>
                                 identity.NormalizedEmail == claim.NormalizedEmail &&
                                 identity.UserId == claim.RequesterUserId &&
                                 identity.Status == "VERIFIED") &&
                             (claim.TargetCandidateId.HasValue &&
                              claim.TargetCandidateId != claim.RequesterCandidateId
                                 ? claim.TargetCandidate != null &&
                                   claim.TargetCandidate.UserId == claim.RequesterUserId &&
                                   claim.TargetCandidate.Status == "ACTIVE" &&
                                   claim.TargetCandidate.MergedIntoCandidateId == null &&
                                   claim.TargetCandidate.NormalizedEmail == claim.NormalizedEmail &&
                                   claim.RequesterCandidate.UserId == null &&
                                   claim.RequesterCandidate.Status == "ARCHIVED" &&
                                   claim.RequesterCandidate.MergedIntoCandidateId == claim.TargetCandidateId
                                 : claim.RequesterCandidate.UserId == claim.RequesterUserId &&
                                   claim.RequesterCandidate.Status == "ACTIVE" &&
                                   claim.RequesterCandidate.MergedIntoCandidateId == null)))
            .ExecuteUpdateAsync(update => update
                .SetProperty(claim => claim.Status, status)
                .SetProperty(claim => claim.ReviewedBy, reviewedBy)
                .SetProperty(claim => claim.ReviewedAt, reviewedAt)
                .SetProperty(claim => claim.CompletedAt, reviewedAt)
                .SetProperty(claim => claim.ReviewReason, reviewReason)
                .SetProperty(claim => claim.UpdatedAt, reviewedAt)
                .SetProperty(claim => claim.ConcurrencyToken, newConcurrencyToken), cancellationToken));

    private static async Task<bool> ExecuteAndCheckAsync(Task<int> update) =>
        await update == 1;
}
