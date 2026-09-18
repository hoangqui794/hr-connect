using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IAffiliateProfileRepository
{
    Task<AffiliateProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<AffiliateProfile?> GetByIdAsync(Guid affiliateId, CancellationToken cancellationToken = default);

    Task AddAsync(AffiliateProfile profile, CancellationToken cancellationToken = default);

    void Update(AffiliateProfile profile);
}
