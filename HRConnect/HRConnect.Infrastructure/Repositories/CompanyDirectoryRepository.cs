using HRConnect.Application.Features.Companies.Directory;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class CompanyDirectoryRepository : ICompanyDirectoryRepository
{
    private const string Verified = "VERIFIED";
    private readonly ApplicationDbContext _context;

    public CompanyDirectoryRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Industry>> GetIndustriesAsync(bool includeInactive, CancellationToken cancellationToken = default) =>
        await _context.Industries.AsNoTracking().Where(i => includeInactive || i.IsActive).ToListAsync(cancellationToken);

    public Task<Industry?> GetIndustryAsync(Guid industryId, CancellationToken cancellationToken = default) =>
        _context.Industries.FirstOrDefaultAsync(i => i.IndustryId == industryId, cancellationToken);

    public Task<bool> IndustryCodeExistsAsync(string code, CancellationToken cancellationToken = default) =>
        _context.Industries.AnyAsync(i => i.Code == code, cancellationToken);

    public async Task AddIndustryAsync(Industry industry, CancellationToken cancellationToken = default) =>
        await _context.Industries.AddAsync(industry, cancellationToken);

    public async Task<IReadOnlyList<CompanySizeOption>> GetActiveCompanySizesAsync(CancellationToken cancellationToken = default) =>
        await _context.CompanySizes.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.SortOrder).ToListAsync(cancellationToken);

    public Task<CompanySizeOption?> GetCompanySizeAsync(Guid companySizeId, CancellationToken cancellationToken = default) =>
        _context.CompanySizes.AsNoTracking().FirstOrDefaultAsync(s => s.CompanySizeId == companySizeId, cancellationToken);

    public async Task<(IReadOnlyList<(Company Company, int ActiveJobCount)> Items, int TotalCount)> SearchVerifiedAsync(
        CompanyDirectoryFilter filter, IReadOnlyCollection<string> roleCodes, CancellationToken cancellationToken = default)
    {
        var query = _context.Companies.AsNoTracking().Where(c => c.VerificationStatus == Verified);
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var pattern = $"%{filter.Search[..Math.Min(filter.Search.Length, 200)]}%";
            query = query.Where(c => EF.Functions.ILike(c.CompanyName, pattern));
        }
        if (filter.IndustryIds is { Count: > 0 })
            query = query.Where(c => c.IndustryId != null && filter.IndustryIds.Contains(c.IndustryId.Value));
        if (filter.CompanySizeId.HasValue)
            query = query.Where(c => c.CompanySizeId == filter.CompanySizeId);
        if (!string.IsNullOrWhiteSpace(filter.Location))
        {
            var pattern = $"%{filter.Location}%";
            query = query.Where(c => c.Address != null && EF.Functions.ILike(c.Address, pattern));
        }

        var total = await query.CountAsync(cancellationToken);
        var page = await WithJobCounts(query
                .OrderByDescending(c => c.IsFeatured).ThenBy(c => c.FeaturedOrder).ThenBy(c => c.CompanyName).ThenBy(c => c.CompanyId)
                .Skip((filter.Page - 1) * filter.PageSize).Take(filter.PageSize), roleCodes)
            .ToListAsync(cancellationToken);
        return (page.Select(x => (x.Company, x.Count)).ToList(), total);
    }

    public async Task<IReadOnlyList<(Company Company, int ActiveJobCount)>> GetFeaturedAsync(
        IReadOnlyCollection<string> roleCodes, CancellationToken cancellationToken = default)
    {
        var items = await WithJobCounts(_context.Companies.AsNoTracking()
                .Where(c => c.VerificationStatus == Verified && c.IsFeatured)
                .OrderBy(c => c.FeaturedOrder ?? int.MaxValue).ThenBy(c => c.CompanyName), roleCodes)
            .ToListAsync(cancellationToken);
        return items.Select(x => (x.Company, x.Count)).ToList();
    }

    public async Task<(Company Company, IReadOnlyList<Job> Jobs)?> GetVerifiedWithJobsAsync(
        Guid companyId, IReadOnlyCollection<string> roleCodes, CancellationToken cancellationToken = default)
    {
        var company = await _context.Companies.AsNoTracking()
            .Include(c => c.IndustryRef).Include(c => c.CompanySizeRef)
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.VerificationStatus == Verified, cancellationToken);
        if (company == null) return null;

        var jobs = await VisibleJobs(roleCodes).Where(j => j.CompanyId == companyId)
            .OrderByDescending(j => j.PostedAt).ThenBy(j => j.JobId)
            .Include(j => j.Company).Include(j => j.ServiceType).Include(j => j.JobRequirements)
            .Include(j => j.JobSkills).ThenInclude(js => js.Skill)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
        return (company, jobs);
    }

    public Task<Company?> GetCompanyForUpdateAsync(Guid companyId, CancellationToken cancellationToken = default) =>
        _context.Companies.Include(c => c.IndustryRef).Include(c => c.CompanySizeRef)
            .FirstOrDefaultAsync(c => c.CompanyId == companyId, cancellationToken);

    /// <summary>ACTIVE jobs whose Service Type the roles may view (same rule as the public job list).</summary>
    private IQueryable<Job> VisibleJobs(IReadOnlyCollection<string> roleCodes)
    {
        var allowed = _context.ServiceTypeAllowedRoles.AsNoTracking()
            .Where(m => m.CanView && m.Role.IsActive && roleCodes.Contains(m.Role.Code))
            .Select(m => m.ServiceTypeId);
        return _context.Jobs.AsNoTracking().Where(j => j.Status == JobStatuses.Active && allowed.Contains(j.ServiceTypeId));
    }

    private IQueryable<CompanyWithCount> WithJobCounts(IQueryable<Company> companies, IReadOnlyCollection<string> roleCodes)
    {
        var jobs = VisibleJobs(roleCodes);
        return companies
            .Include(c => c.IndustryRef).Include(c => c.CompanySizeRef)
            .Select(c => new CompanyWithCount { Company = c, Count = jobs.Count(j => j.CompanyId == c.CompanyId) });
    }

    private sealed class CompanyWithCount
    {
        public Company Company { get; init; } = null!;
        public int Count { get; init; }
    }
}
