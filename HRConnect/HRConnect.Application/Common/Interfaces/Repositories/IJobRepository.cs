using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IJobRepository
{
    Task<bool> IsServiceTypeActiveAsync(Guid serviceTypeId, CancellationToken cancellationToken = default);

    Task AddAsync(Job job, CancellationToken cancellationToken = default);

    Task<Job?> GetByIdAsync(Guid jobId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Job>> GetByCompanyIdAsync(Guid companyId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Job>> GetPendingReviewAsync(CancellationToken cancellationToken = default);

    void Update(Job job);
}
