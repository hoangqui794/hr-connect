using HRConnect.Application.Common.Interfaces.Repositories;
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
            .Include(job => job.JobRequirements)
            .Include(job => job.JobSkills).ThenInclude(jobSkill => jobSkill.Skill)
            .Include(job => job.JobStatusHistories)
            .FirstOrDefaultAsync(job => job.JobId == jobId, cancellationToken);

    public async Task<IReadOnlyList<Job>> GetByCompanyIdAsync(Guid companyId, CancellationToken cancellationToken = default) =>
        await _context.Jobs.AsNoTracking()
            .Include(job => job.ServiceType)
            .Include(job => job.JobRequirements)
            .Include(job => job.JobSkills).ThenInclude(jobSkill => jobSkill.Skill)
            .Where(job => job.CompanyId == companyId)
            .OrderByDescending(job => job.UpdatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Job>> GetPendingReviewAsync(CancellationToken cancellationToken = default) =>
        await _context.Jobs.AsNoTracking()
            .Include(job => job.ServiceType)
            .Include(job => job.Company)
            .Include(job => job.JobRequirements)
            .Include(job => job.JobSkills).ThenInclude(jobSkill => jobSkill.Skill)
            .Where(job => job.Status == "PENDING_REVIEW")
            .OrderBy(job => job.UpdatedAt)
            .ToListAsync(cancellationToken);

    public async Task<(IReadOnlyList<Job> Items, int TotalCount)> GetVisibleJobsAsync(
        IReadOnlyCollection<string> roleCodes,
        string? search,
        string? location,
        string? employmentType,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var allowedServiceTypeIds = _context.ServiceTypeAllowedRoles.AsNoTracking()
            .Where(mapping => mapping.CanView && mapping.Role.IsActive && roleCodes.Contains(mapping.Role.Code))
            .Select(mapping => mapping.ServiceTypeId);

        var query = _context.Jobs.AsNoTracking()
            .Where(job => job.Status == "ACTIVE" && job.Visibility == "PUBLIC" &&
                          allowedServiceTypeIds.Contains(job.ServiceTypeId));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(job => EF.Functions.ILike(job.Title, pattern) ||
                                       (job.Description != null && EF.Functions.ILike(job.Description, pattern)));
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

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(job => job.Company)
            .Include(job => job.ServiceType)
            .Include(job => job.JobRequirements)
            .Include(job => job.JobSkills).ThenInclude(jobSkill => jobSkill.Skill)
            .OrderByDescending(job => job.PostedAt)
            .ThenBy(job => job.JobId)
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

    public void Update(Job job) => _context.Jobs.Update(job);
}
