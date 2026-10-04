using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IAdminUserRepository
{
    Task<(IReadOnlyList<AppUser> Items, int TotalCount)> GetUsersAsync(
        string? search,
        string? status,
        string? role,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AppUser?> GetByIdWithRolesAsync(
        Guid userId,
        bool tracking = false,
        CancellationToken cancellationToken = default);

    void Update(AppUser user);
}
