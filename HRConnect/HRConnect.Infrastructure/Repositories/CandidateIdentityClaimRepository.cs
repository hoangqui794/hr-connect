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
}
