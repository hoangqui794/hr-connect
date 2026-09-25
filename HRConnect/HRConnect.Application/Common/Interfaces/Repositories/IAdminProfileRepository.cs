using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IAdminProfileRepository
{
    Task<AdminProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<AdminProfile?> GetByUserIdWithDetailsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task AddAsync(AdminProfile profile, CancellationToken cancellationToken = default);

    void Update(AdminProfile profile);
}
