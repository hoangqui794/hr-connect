using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class UserEmailIdentityRepository(ApplicationDbContext context) : IUserEmailIdentityRepository
{
    public Task<bool> ExistsActiveByNormalizedEmailAsync(
        string normalizedEmail,
        CancellationToken cancellationToken = default) =>
        context.UserEmailIdentities.AnyAsync(
            item => item.NormalizedEmail == normalizedEmail && item.Status != "REVOKED",
            cancellationToken);

    public Task<UserEmailIdentity?> GetActiveByNormalizedEmailAsync(
        string normalizedEmail,
        CancellationToken cancellationToken = default) =>
        context.UserEmailIdentities
            .Include(item => item.User)
            .SingleOrDefaultAsync(
                item => item.NormalizedEmail == normalizedEmail && item.Status != "REVOKED",
                cancellationToken);

    public Task<UserEmailIdentity?> GetPrimaryByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default) =>
        context.UserEmailIdentities.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Kind == "PRIMARY" && item.Status != "REVOKED",
            cancellationToken);

    public async Task<IReadOnlyList<UserEmailIdentity>> GetByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default) =>
        await context.UserEmailIdentities
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.Kind == "PRIMARY" ? 0 : 1)
            .ThenByDescending(item => item.VerifiedAt)
            .ToListAsync(cancellationToken);

    public Task AddAsync(UserEmailIdentity identity, CancellationToken cancellationToken = default) =>
        context.UserEmailIdentities.AddAsync(identity, cancellationToken).AsTask();

    public void Update(UserEmailIdentity identity) => context.UserEmailIdentities.Update(identity);
}
