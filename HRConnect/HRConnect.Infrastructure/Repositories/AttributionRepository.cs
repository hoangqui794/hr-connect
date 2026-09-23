using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class AttributionRepository : IAttributionRepository
{
    private readonly ApplicationDbContext _context;

    public AttributionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Attribution?> GetByApplicationIdAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.Attributions
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId, cancellationToken);
    }

    public async Task<Attribution?> GetByWinningSubmissionIdAsync(Guid winningSubmissionId, CancellationToken cancellationToken = default)
    {
        return await _context.Attributions
            .FirstOrDefaultAsync(a => a.WinningSubmissionId == winningSubmissionId, cancellationToken);
    }

    public async Task AddAsync(Attribution attribution, CancellationToken cancellationToken = default)
    {
        await _context.Attributions.AddAsync(attribution, cancellationToken);
    }

    public void Update(Attribution attribution)
    {
        _context.Attributions.Update(attribution);
    }

    public async Task<(IReadOnlyList<Attribution> Items, int TotalCount)> GetAffiliateAttributionsAsync(
        Guid affiliateId,
        Guid? jobId,
        Guid? candidateId,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Attributions
            .AsNoTracking()
            .Where(a => a.AffiliateId == affiliateId);

        if (jobId.HasValue)
        {
            query = query.Where(a => a.Application.JobId == jobId.Value);
        }

        if (candidateId.HasValue)
        {
            query = query.Where(a => a.Application.CandidateId == candidateId.Value);
        }

        if (fromDate.HasValue)
        {
            var fromUtc = fromDate.Value.ToUniversalTime();
            query = query.Where(a => a.EstablishedAt >= fromUtc);
        }

        if (toDate.HasValue)
        {
            var toUtc = toDate.Value.ToUniversalTime();
            query = query.Where(a => a.EstablishedAt <= toUtc);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(a => a.Application)
                .ThenInclude(app => app.Job)
            .Include(a => a.Application)
                .ThenInclude(app => app.Candidate)
            .Include(a => a.WinningSubmission)
            .OrderByDescending(a => a.EstablishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }
}
