using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IUserRoleRepository
{
    Task AddAsync(UserRole userRole, CancellationToken cancellationToken = default);
}
