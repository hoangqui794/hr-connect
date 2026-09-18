using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IRoleRepository
{
    Task<Role?> GetByCodeAsync(string code, CancellationToken cancellationToken = default);
}
