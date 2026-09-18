using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IAffiliateApplicationRepository
{
    Task AddAsync(AffiliateApplication application, CancellationToken cancellationToken = default);

    Task<AffiliateApplication?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<AffiliateApplication?> GetByIdAsync(Guid applicationId, CancellationToken cancellationToken = default);

    void Update(AffiliateApplication application);
}
