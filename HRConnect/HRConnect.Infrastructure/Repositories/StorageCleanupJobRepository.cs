using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;

namespace HRConnect.Infrastructure.Repositories;

public sealed class StorageCleanupJobRepository(ApplicationDbContext context) : IStorageCleanupJobRepository
{
    public Task AddAsync(StorageCleanupJob job, CancellationToken cancellationToken = default) =>
        context.StorageCleanupJobs.AddAsync(job, cancellationToken).AsTask();
}
