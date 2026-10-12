using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class CandidateSavedJobRepository : ICandidateSavedJobRepository
{
    private readonly ApplicationDbContext _context;

    public CandidateSavedJobRepository(ApplicationDbContext context) => _context = context;

    public Task<bool> IsSavedAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default) =>
        _context.CandidateSavedJobs.AsNoTracking()
            .AnyAsync(s => s.CandidateId == candidateId && s.JobId == jobId, cancellationToken);

    public Task AddAsync(CandidateSavedJob savedJob, CancellationToken cancellationToken = default) =>
        _context.CandidateSavedJobs.AddAsync(savedJob, cancellationToken).AsTask();

    public async Task<bool> RemoveAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default)
    {
        var item = await _context.CandidateSavedJobs
            .FirstOrDefaultAsync(s => s.CandidateId == candidateId && s.JobId == jobId, cancellationToken);

        if (item == null) return false;

        _context.CandidateSavedJobs.Remove(item);
        return true;
    }

    public async Task<(IReadOnlyList<CandidateSavedJob> Items, int TotalCount)> GetSavedJobsAsync(
        Guid candidateId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.CandidateSavedJobs.AsNoTracking()
            .Where(s => s.CandidateId == candidateId)
            .Include(s => s.Job).ThenInclude(j => j.Company)
            .Include(s => s.Job).ThenInclude(j => j.ServiceType);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .ThenBy(s => s.CandidateSavedJobId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }
}
