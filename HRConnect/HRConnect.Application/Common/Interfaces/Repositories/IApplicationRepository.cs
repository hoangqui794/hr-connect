using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IApplicationRepository
{
    Task<JobApplication?> GetByCandidateAndJobAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    Task<JobApplication?> GetByIdAsync(Guid applicationId, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    Task AddAsync(JobApplication application, CancellationToken cancellationToken = default);

    void Update(JobApplication application);
}
