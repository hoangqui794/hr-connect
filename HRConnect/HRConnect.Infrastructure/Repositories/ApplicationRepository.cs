using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Infrastructure.Repositories;

public class ApplicationRepository : IApplicationRepository
{
    private readonly ApplicationDbContext _context;

    public ApplicationRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<JobApplication?> GetByCandidateAndJobAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default)
    {
        return await _context.Applications
            .Include(a => a.Attribution)
            .Include(a => a.Submission)
            .FirstOrDefaultAsync(a => a.CandidateId == candidateId && a.JobId == jobId, cancellationToken);
    }

    public async Task<JobApplication?> GetByIdAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.Applications
            .Include(a => a.Attribution)
            .Include(a => a.Submission)
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId, cancellationToken);
    }

    public async Task<bool> ExistsAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default)
    {
        return await _context.Applications
            .AnyAsync(a => a.CandidateId == candidateId && a.JobId == jobId, cancellationToken);
    }

    public async Task AddAsync(JobApplication application, CancellationToken cancellationToken = default)
    {
        await _context.Applications.AddAsync(application, cancellationToken);
    }

    public void Update(JobApplication application)
    {
        _context.Applications.Update(application);
    }
}
