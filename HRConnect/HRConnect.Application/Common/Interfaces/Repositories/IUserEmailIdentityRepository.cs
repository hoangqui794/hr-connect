using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IUserEmailIdentityRepository
{
    Task<bool> ExistsActiveByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);

    Task<UserEmailIdentity?> GetActiveByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);

    Task<UserEmailIdentity?> GetPrimaryByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<UserEmailIdentity>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task AddAsync(UserEmailIdentity identity, CancellationToken cancellationToken = default);

    void Update(UserEmailIdentity identity);
}
