using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IAttributionRepository
{
    Task<Attribution?> GetByApplicationIdAsync(Guid applicationId, CancellationToken cancellationToken = default);

    Task<Attribution?> GetByWinningSubmissionIdAsync(Guid winningSubmissionId, CancellationToken cancellationToken = default);

    Task AddAsync(Attribution attribution, CancellationToken cancellationToken = default);

    void Update(Attribution attribution);
}
