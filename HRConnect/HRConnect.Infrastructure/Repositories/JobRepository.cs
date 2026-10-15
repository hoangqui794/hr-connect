using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class JobRepository : IJobRepository
{
    private readonly ApplicationDbContext _context;

    public JobRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<bool> IsServiceTypeActiveAsync(Guid serviceTypeId, CancellationToken cancellationToken = default)
    {
        return _context.ServiceTypes
            .AsNoTracking()
            .AnyAsync(
                serviceType => serviceType.ServiceTypeId == serviceTypeId && serviceType.IsActive,
                cancellationToken);
    }

    public Task<string?> GetActiveServiceTypeCodeAsync(
        Guid serviceTypeId,
        CancellationToken cancellationToken = default) =>
        _context.ServiceTypes.AsNoTracking()
            .Where(serviceType => serviceType.ServiceTypeId == serviceTypeId && serviceType.IsActive)
            .Select(serviceType => serviceType.Code)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<bool> AreSkillsActiveAsync(IReadOnlyCollection<Guid> skillIds, CancellationToken cancellationToken = default)
    {
        if (skillIds.Count == 0) return true;
        var activeCount = await _context.Skills.AsNoTracking()
            .CountAsync(skill => skillIds.Contains(skill.SkillId) && skill.IsActive, cancellationToken);
        return activeCount == skillIds.Count;
    }

    public async Task AddAsync(Job job, CancellationToken cancellationToken = default)
    {
        await _context.Jobs.AddAsync(job, cancellationToken);
    }

    public async Task AddStatusHistoryAsync(JobStatusHistory history, CancellationToken cancellationToken = default)
    {
        await _context.JobStatusHistories.AddAsync(history, cancellationToken);
    }

    public Task<Job?> GetByIdAsync(Guid jobId, CancellationToken cancellationToken = default) =>
        _context.Jobs
            .Include(job => job.ServiceType)
            .Include(job => job.Company)
            .Include(job => job.PostingPackage)
            .Include(job => job.JobPostingFees)
            .Include(job => job.JobRequirements)
            .Include(job => job.JobSkills).ThenInclude(jobSkill => jobSkill.Skill)
            .Include(job => job.JobStatusHistories)
            .FirstOrDefaultAsync(job => job.JobId == jobId, cancellationToken);

    public async Task<bool> HasSubmissionsOrApplicationsAsync(
        Guid jobId,
        CancellationToken cancellationToken = default)
    {
        if (await _context.Submissions.AsNoTracking()
                .AnyAsync(submission => submission.JobId == jobId, cancellationToken))
        {
            return true;
        }

        return await _context.Applications.AsNoTracking()
            .AnyAsync(application => application.JobId == jobId, cancellationToken);
    }

    public async Task<IReadOnlyList<Job>> GetByCompanyIdAsync(Guid companyId, CancellationToken cancellationToken = default) =>
        await _context.Jobs.AsNoTracking()
            .Include(job => job.ServiceType)
            .Include(job => job.PostingPackage)
            .Include(job => job.JobPostingFees)
            .Include(job => job.JobRequirements)
            .Include(job => job.JobSkills).ThenInclude(jobSkill => jobSkill.Skill)
            .Where(job => job.CompanyId == companyId)
            .OrderByDescending(job => job.UpdatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Job>> GetForReviewAsync(string? status = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Jobs.AsNoTracking()
            .Include(job => job.ServiceType)
            .Include(job => job.Company)
            .Include(job => job.PostingPackage)
            .Include(job => job.JobPostingFees)
            .Include(job => job.JobRequirements)
            .Include(job => job.JobSkills).ThenInclude(jobSkill => jobSkill.Skill)
            .Include(job => job.JobStatusHistories)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = status.Trim().ToUpperInvariant();
            query = query.Where(job => job.Status == normalizedStatus);
        }

        return await query
            .OrderByDescending(job => job.UpdatedAt)
            .ToListAsync(cancellationToken);
    }

    public Task<IReadOnlyList<Job>> GetPendingReviewAsync(CancellationToken cancellationToken = default) =>
        GetForReviewAsync("PENDING_REVIEW", cancellationToken);

    public async Task<(IReadOnlyList<Job> Items, int TotalCount)> GetVisibleJobsAsync(
        IReadOnlyCollection<string> roleCodes,
        IReadOnlyCollection<string> allowedVisibilities,
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
        CancellationToken cancellationToken = default)
    {
        var allowedServiceTypeIds = _context.ServiceTypeAllowedRoles.AsNoTracking()
            .Where(mapping => mapping.CanView && mapping.Role.IsActive && roleCodes.Contains(mapping.Role.Code))
            .Select(mapping => mapping.ServiceTypeId);

        var query = _context.Jobs.AsNoTracking()
            .Where(job => job.Status == JobStatuses.Active &&
                          allowedVisibilities.Contains(job.Visibility) &&
                          (bypassServiceTypeRoleCheck || allowedServiceTypeIds.Contains(job.ServiceTypeId)));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var trimmedSearch = search.Trim();
            if (trimmedSearch.Length > 200) trimmedSearch = trimmedSearch[..200];
            var pattern = $"%{trimmedSearch}%";
            query = query.Where(job =>
                EF.Functions.ILike(job.Title, pattern) ||
                (job.Description != null && EF.Functions.ILike(job.Description, pattern)) ||
                (job.Company != null && EF.Functions.ILike(job.Company.CompanyName, pattern)) ||
                job.JobSkills.Any(js => js.Skill != null && EF.Functions.ILike(js.Skill.SkillName, pattern)));
        }

        if (!string.IsNullOrWhiteSpace(location))
        {
            var pattern = $"%{location.Trim()}%";
            query = query.Where(job => job.Location != null && EF.Functions.ILike(job.Location, pattern));
        }

        if (!string.IsNullOrWhiteSpace(employmentType))
        {
            var normalized = employmentType.Trim().ToUpperInvariant();
            query = query.Where(job => job.EmploymentType == normalized);
        }

        if (serviceTypeId.HasValue)
            query = query.Where(job => job.ServiceTypeId == serviceTypeId.Value);

        if (salaryMin.HasValue)
            query = query.Where(job => job.SalaryMax == null || job.SalaryMax >= salaryMin.Value);

        if (salaryMax.HasValue)
            query = query.Where(job => job.SalaryMin == null || job.SalaryMin <= salaryMax.Value);

        var totalCount = await query.CountAsync(cancellationToken);

        var normalizedSortBy = string.IsNullOrWhiteSpace(sortBy) ? "POSTED_AT" : sortBy.Trim().ToUpperInvariant();
        var normalizedSortDirection = string.IsNullOrWhiteSpace(sortDirection) ? "DESC" : sortDirection.Trim().ToUpperInvariant();

        var orderedQuery = (normalizedSortBy, normalizedSortDirection) switch
        {
            ("SALARY", "ASC") => query
                .OrderBy(job => !job.SalaryMin.HasValue && !job.SalaryMax.HasValue)
                .ThenBy(job => job.SalaryMin ?? job.SalaryMax)
                .ThenBy(job => job.SalaryMax)
                .ThenByDescending(job => job.PostedAt)
                .ThenBy(job => job.JobId),

            ("SALARY", "DESC") => query
                .OrderBy(job => !job.SalaryMax.HasValue && !job.SalaryMin.HasValue)
                .ThenByDescending(job => job.SalaryMax ?? job.SalaryMin)
                .ThenByDescending(job => job.SalaryMin)
                .ThenByDescending(job => job.PostedAt)
                .ThenBy(job => job.JobId),

            ("POSTED_AT", "ASC") => query
                .OrderBy(job => job.PostedAt)
                .ThenBy(job => job.JobId),

            _ => query
                .OrderByDescending(job => job.PostedAt)
                .ThenBy(job => job.JobId)
        };

        var items = await orderedQuery
            .Include(job => job.Company)
            .Include(job => job.ServiceType)
            .Include(job => job.JobRequirements)
            .Include(job => job.JobSkills).ThenInclude(jobSkill => jobSkill.Skill)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public Task<bool> CanAnyRoleViewJobAsync(
        Guid serviceTypeId,
        IReadOnlyCollection<string> roleCodes,
        CancellationToken cancellationToken = default) =>
        _context.ServiceTypeAllowedRoles.AsNoTracking().AnyAsync(
            mapping => mapping.ServiceTypeId == serviceTypeId && mapping.CanView &&
                       mapping.Role.IsActive && roleCodes.Contains(mapping.Role.Code),
            cancellationToken);

    public Task<bool> CanAnyRoleSubmitJobAsync(
        Guid serviceTypeId,
        IReadOnlyCollection<string> roleCodes,
        CancellationToken cancellationToken = default) =>
        _context.ServiceTypeAllowedRoles.AsNoTracking().AnyAsync(
            mapping => mapping.ServiceTypeId == serviceTypeId && mapping.CanSubmit &&
                       mapping.Role.IsActive && roleCodes.Contains(mapping.Role.Code),
            cancellationToken);

    public Task<bool> CanAnyRoleSubmitJobByIdsAsync(
        Guid serviceTypeId,
        IReadOnlyCollection<Guid> roleIds,
        CancellationToken cancellationToken = default) =>
        _context.ServiceTypeAllowedRoles.AsNoTracking().AnyAsync(
            mapping => mapping.ServiceTypeId == serviceTypeId && mapping.CanSubmit &&
                       mapping.Role.IsActive && roleIds.Contains(mapping.RoleId),
            cancellationToken);

    public async Task<IReadOnlyList<JobPostingPackage>> GetPostingPackagesAsync(
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var query = _context.JobPostingPackages.AsNoTracking();
        if (activeOnly)
        {
            query = query.Where(p => p.IsActive);
        }
        return await query.OrderBy(p => p.Price).ToListAsync(cancellationToken);
    }

    public async Task<bool> TryUseTemplateAsync(Guid templateId, CancellationToken cancellationToken = default)
    {
        // Tracked update so the counter is saved in the same SaveChanges as the new job.
        var template = await _context.JobTemplates.FirstOrDefaultAsync(t => t.TemplateId == templateId, cancellationToken);
        if (template == null) return false;
        template.UsageCount += 1;
        return true;
    }

    public Task<JobPostingPackage?> GetPostingPackageByIdAsync(
        Guid packageId,
        CancellationToken cancellationToken = default) =>
        _context.JobPostingPackages.FirstOrDefaultAsync(p => p.PackageId == packageId, cancellationToken);

    public Task<JobPostingPackage?> GetPostingPackageByCodeAsync(
        string code,
        CancellationToken cancellationToken = default) =>
        _context.JobPostingPackages.FirstOrDefaultAsync(
            p => p.Code.ToUpper() == code.ToUpper(), cancellationToken);

    public async Task AddPostingFeeAsync(
        JobPostingFee fee,
        CancellationToken cancellationToken = default)
    {
        await _context.JobPostingFees.AddAsync(fee, cancellationToken);
    }

    public Task<JobPostingFee?> GetPostingFeeByJobIdAsync(
        Guid jobId,
        CancellationToken cancellationToken = default) =>
        _context.JobPostingFees
            .Include(f => f.Package)
            .Include(f => f.Job)
            .OrderByDescending(f => f.CreatedAt)
            .FirstOrDefaultAsync(f => f.JobId == jobId, cancellationToken);

    public async Task<IReadOnlyList<Job>> GetExpiredActiveJobsAsync(
        DateTime now,
        int take = 100,
        CancellationToken cancellationToken = default) =>
        await _context.Jobs
            .Include(j => j.JobStatusHistories)
            .Include(j => j.PostingPackage)
            .Where(j => j.Status == JobStatuses.Active && j.ExpiresAt != null && j.ExpiresAt <= now)
            .OrderBy(j => j.ExpiresAt)
            .Take(take)
            .ToListAsync(cancellationToken);

    public Task<int> CountActiveJobsByCompanyIdAsync(
        Guid companyId,
        CancellationToken cancellationToken = default) =>
        _context.Jobs
            .AsNoTracking()
            .CountAsync(j => j.CompanyId == companyId && j.Status == JobStatuses.Active, cancellationToken);

    public Task<Job?> GetLastPostedJobByCompanyIdAsync(
        Guid companyId,
        string? packageCode = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Jobs.AsNoTracking()
            .Where(j => j.CompanyId == companyId && j.PostedAt != null);

        if (!string.IsNullOrWhiteSpace(packageCode))
        {
            query = query.Where(j => j.PostingPackage != null && j.PostingPackage.Code.ToUpper() == packageCode.ToUpper());
        }

        return query.OrderByDescending(j => j.PostedAt).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<int> CountAcceptedApplicationsByJobIdAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        return await _context.Applications.AsNoTracking()
            .CountAsync(a => a.JobId == jobId, cancellationToken);
    }

    public void Update(Job job) => _context.Jobs.Update(job);
}
