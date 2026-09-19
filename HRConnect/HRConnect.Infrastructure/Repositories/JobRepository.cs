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

    public async Task AddAsync(Job job, CancellationToken cancellationToken = default)
    {
        await _context.Jobs.AddAsync(job, cancellationToken);
    }

    public Task<Job?> GetByIdAsync(Guid jobId, CancellationToken cancellationToken = default) =>
        _context.Jobs
            .Include(job => job.ServiceType)
            .Include(job => job.Company)
            .Include(job => job.JobRequirements)
            .Include(job => job.JobStatusHistories)
            .FirstOrDefaultAsync(job => job.JobId == jobId, cancellationToken);

    public async Task<IReadOnlyList<Job>> GetByCompanyIdAsync(Guid companyId, CancellationToken cancellationToken = default) =>
        await _context.Jobs.AsNoTracking()
            .Include(job => job.ServiceType)
            .Include(job => job.JobRequirements)
            .Where(job => job.CompanyId == companyId)
            .OrderByDescending(job => job.UpdatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Job>> GetPendingReviewAsync(CancellationToken cancellationToken = default) =>
        await _context.Jobs.AsNoTracking()
            .Include(job => job.ServiceType)
            .Include(job => job.Company)
            .Include(job => job.JobRequirements)
            .Where(job => job.Status == "PENDING_REVIEW")
            .OrderBy(job => job.UpdatedAt)
            .ToListAsync(cancellationToken);

    public void Update(Job job) => _context.Jobs.Update(job);
}
