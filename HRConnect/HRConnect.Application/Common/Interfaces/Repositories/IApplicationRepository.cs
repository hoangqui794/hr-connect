using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IApplicationRepository
{
    Task<JobApplication?> GetByCandidateAndJobAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    Task<JobApplication?> GetByIdAsync(Guid applicationId, CancellationToken cancellationToken = default);

    Task<JobApplication?> GetByIdWithDetailsAsync(Guid applicationId, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<JobApplication> Items, int TotalCount)> GetCandidateApplicationsAsync(
        Guid candidateId,
        string? status,
        Guid? jobId,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<JobApplication> Items, int TotalCount)> GetRecruitmentApplicationsAsync(
        Guid? companyId,
        Guid? jobId,
        string? status,
        string? candidateName,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<JobApplication?> GetRecruitmentApplicationDetailAsync(Guid applicationId, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    Task AddAsync(JobApplication application, CancellationToken cancellationToken = default);

    void Update(JobApplication application);
}
