using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IJobRepository
{
    Task<bool> IsServiceTypeActiveAsync(Guid serviceTypeId, CancellationToken cancellationToken = default);

    Task<bool> AreSkillsActiveAsync(IReadOnlyCollection<Guid> skillIds, CancellationToken cancellationToken = default);

    Task AddAsync(Job job, CancellationToken cancellationToken = default);

    Task AddStatusHistoryAsync(JobStatusHistory history, CancellationToken cancellationToken = default);

    Task<Job?> GetByIdAsync(Guid jobId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Job>> GetByCompanyIdAsync(Guid companyId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Job>> GetPendingReviewAsync(CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<Job> Items, int TotalCount)> GetVisibleJobsAsync(
        IReadOnlyCollection<string> roleCodes,
        string? search,
        string? location,
        string? employmentType,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<bool> CanAnyRoleViewJobAsync(
        Guid serviceTypeId,
        IReadOnlyCollection<string> roleCodes,
        CancellationToken cancellationToken = default);

    void Update(Job job);
}
