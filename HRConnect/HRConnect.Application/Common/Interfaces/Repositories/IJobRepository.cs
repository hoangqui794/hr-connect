using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IJobRepository
{
    Task<bool> IsServiceTypeActiveAsync(Guid serviceTypeId, CancellationToken cancellationToken = default);

    Task<string?> GetActiveServiceTypeCodeAsync(Guid serviceTypeId, CancellationToken cancellationToken = default);

    Task<bool> AreSkillsActiveAsync(IReadOnlyCollection<Guid> skillIds, CancellationToken cancellationToken = default);

    Task AddAsync(Job job, CancellationToken cancellationToken = default);

    Task AddStatusHistoryAsync(JobStatusHistory history, CancellationToken cancellationToken = default);

    Task<Job?> GetByIdAsync(Guid jobId, CancellationToken cancellationToken = default);

    Task<bool> HasSubmissionsOrApplicationsAsync(Guid jobId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Job>> GetByCompanyIdAsync(Guid companyId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Job>> GetPendingReviewAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Job>> GetForReviewAsync(string? status = null, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<Job> Items, int TotalCount)> GetVisibleJobsAsync(
        IReadOnlyCollection<string> roleCodes,
        bool bypassServiceTypeRoleCheck,
        string? search,
        string? location,
        string? employmentType,
        Guid? serviceTypeId,
        decimal? salaryMin,
        decimal? salaryMax,
        int page,
        int pageSize,
        string? sortBy = null,
        string? sortDirection = null,
        CancellationToken cancellationToken = default);

    Task<bool> CanAnyRoleViewJobAsync(
        Guid serviceTypeId,
        IReadOnlyCollection<string> roleCodes,
        CancellationToken cancellationToken = default);

    Task<bool> CanAnyRoleSubmitJobAsync(
        Guid serviceTypeId,
        IReadOnlyCollection<string> roleCodes,
        CancellationToken cancellationToken = default);

    Task<bool> CanAnyRoleSubmitJobByIdsAsync(
        Guid serviceTypeId,
        IReadOnlyCollection<Guid> roleIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<JobPostingPackage>> GetPostingPackagesAsync(bool activeOnly = true, CancellationToken cancellationToken = default);

    /// <summary>MF-01: adds one to the template's usage count; false when the template does not exist.</summary>
    Task<bool> TryUseTemplateAsync(Guid templateId, CancellationToken cancellationToken = default);

    Task<JobPostingPackage?> GetPostingPackageByIdAsync(Guid packageId, CancellationToken cancellationToken = default);

    Task<JobPostingPackage?> GetPostingPackageByCodeAsync(string code, CancellationToken cancellationToken = default);

    Task AddPostingFeeAsync(JobPostingFee fee, CancellationToken cancellationToken = default);

    Task<JobPostingFee?> GetPostingFeeByJobIdAsync(Guid jobId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Job>> GetExpiredActiveJobsAsync(DateTime now, int take = 100, CancellationToken cancellationToken = default);

    Task<int> CountActiveJobsByCompanyIdAsync(Guid companyId, CancellationToken cancellationToken = default);

    Task<Job?> GetLastPostedJobByCompanyIdAsync(Guid companyId, string? packageCode = null, CancellationToken cancellationToken = default);

    Task<int> CountAcceptedApplicationsByJobIdAsync(Guid jobId, CancellationToken cancellationToken = default);

    void Update(Job job);
}
