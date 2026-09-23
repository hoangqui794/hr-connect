using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IAttributionRepository
{
    Task<Attribution?> GetByApplicationIdAsync(Guid applicationId, CancellationToken cancellationToken = default);

    Task<Attribution?> GetByWinningSubmissionIdAsync(Guid winningSubmissionId, CancellationToken cancellationToken = default);

    Task AddAsync(Attribution attribution, CancellationToken cancellationToken = default);

    void Update(Attribution attribution);

    Task<(IReadOnlyList<Attribution> Items, int TotalCount)> GetAffiliateAttributionsAsync(
        Guid affiliateId,
        Guid? jobId,
        Guid? candidateId,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
