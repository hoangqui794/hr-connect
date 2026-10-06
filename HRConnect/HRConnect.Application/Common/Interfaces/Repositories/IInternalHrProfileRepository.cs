using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IInternalHrProfileRepository
{
    Task<InternalHrProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<InternalHrProfile?> GetByUserIdWithDetailsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task AddAsync(InternalHrProfile profile, CancellationToken cancellationToken = default);

    void Update(InternalHrProfile profile);
}
