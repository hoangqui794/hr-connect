using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class SubmissionRepository : ISubmissionRepository
{
    private readonly ApplicationDbContext _context;

    public SubmissionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Submission?> GetAcceptedSubmissionAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default)
    {
        return await _context.Submissions
            .FirstOrDefaultAsync(s => s.CandidateId == candidateId && s.JobId == jobId && s.Status == "ACCEPTED", cancellationToken);
    }

    public async Task<Submission?> GetByIdAsync(Guid submissionId, CancellationToken cancellationToken = default)
    {
        return await _context.Submissions
            .FirstOrDefaultAsync(s => s.SubmissionId == submissionId, cancellationToken);
    }

    public async Task AddAsync(Submission submission, CancellationToken cancellationToken = default)
    {
        await _context.Submissions.AddAsync(submission, cancellationToken);
    }

    public void Update(Submission submission)
    {
        _context.Submissions.Update(submission);
    }

    public async Task<(IReadOnlyList<Submission> Items, int TotalCount)> GetAffiliateSubmissionsAsync(
        Guid userId,
        string? status,
        Guid? jobId,
        Guid? candidateId,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Submissions
            .AsNoTracking()
            .Where(s => s.SubmittedBy == userId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToUpperInvariant();
            query = query.Where(s => s.Status == normalized);
        }

        if (jobId.HasValue)
        {
            query = query.Where(s => s.JobId == jobId.Value);
        }

        if (candidateId.HasValue)
        {
            query = query.Where(s => s.CandidateId == candidateId.Value);
        }

        if (fromDate.HasValue)
        {
            var fromUtc = fromDate.Value.ToUniversalTime();
            query = query.Where(s => s.SubmittedAt >= fromUtc);
        }

        if (toDate.HasValue)
        {
            var toUtc = toDate.Value.ToUniversalTime();
            query = query.Where(s => s.SubmittedAt <= toUtc);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(s => s.Job)
            .Include(s => s.Candidate)
            .Include(s => s.Applications)
            .Include(s => s.Attribution)
            .OrderByDescending(s => s.SubmittedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<Submission?> GetByIdWithDetailsAsync(Guid submissionId, CancellationToken cancellationToken = default)
    {
        return await _context.Submissions
            .AsNoTracking()
            .Include(s => s.Job)
                .ThenInclude(j => j.Company)
            .Include(s => s.Candidate)
            .Include(s => s.CandidateCv)
            .Include(s => s.Applications)
            .Include(s => s.Attribution)
            .FirstOrDefaultAsync(s => s.SubmissionId == submissionId, cancellationToken);
    }
}
