using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IUserRepository
{
    Task<bool> ExistsByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);

    Task<AppUser?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);

    Task<AppUser?> GetByEmailWithRolesAndPermissionsAsync(string normalizedEmail, CancellationToken cancellationToken = default);

    Task<AppUser?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<AppUser?> GetByIdWithActiveRolesAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Ids of active accounts holding an active assignment of an active role (e.g. INTERNAL_HR), for staff notifications.</summary>
    Task<IReadOnlyList<Guid>> GetActiveUserIdsByRoleAsync(string roleCode, CancellationToken cancellationToken = default);

    Task<AppUser?> GetByIdWithRolesAndPermissionsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task AddAsync(AppUser user, CancellationToken cancellationToken = default);

    void Update(AppUser user);
}
