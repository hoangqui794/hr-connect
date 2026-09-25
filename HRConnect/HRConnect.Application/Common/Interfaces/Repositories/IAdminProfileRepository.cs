using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IAdminProfileRepository
{
    Task<AdminProfile?> GetByUserIdWithDetailsAsync(Guid userId, CancellationToken cancellationToken = default);
}
