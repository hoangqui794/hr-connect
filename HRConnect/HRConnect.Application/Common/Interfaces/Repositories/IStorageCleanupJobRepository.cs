using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IStorageCleanupJobRepository
{
    Task AddAsync(StorageCleanupJob job, CancellationToken cancellationToken = default);
}
