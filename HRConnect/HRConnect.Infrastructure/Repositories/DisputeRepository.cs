using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class DisputeRepository : IDisputeRepository
{
    private const string ActiveAttribution = "ACTIVE";

    private readonly ApplicationDbContext _context;

    public DisputeRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<Submission?> GetSubmissionAsync(Guid submissionId, CancellationToken cancellationToken = default) =>
        _context.Submissions.AsNoTracking()
            .Include(s => s.Job)
            .Include(s => s.Candidate)
            .FirstOrDefaultAsync(s => s.SubmissionId == submissionId, cancellationToken);

    public Task<Attribution?> GetAttributionForUpdateAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default) =>
        _context.Attributions
            .Include(a => a.Affiliate)
            .Include(a => a.Commissions)
            .Include(a => a.Application).ThenInclude(app => app.Placement)
            .FirstOrDefaultAsync(a => a.Status == ActiveAttribution
                                      && a.Application.CandidateId == candidateId
                                      && a.Application.JobId == jobId, cancellationToken);

    public Task<AffiliateProfile?> GetAffiliateByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        _context.AffiliateProfiles.FirstOrDefaultAsync(a => a.UserId == userId, cancellationToken);

    public Task<bool> HasActiveDisputeAsync(Guid submissionId, CancellationToken cancellationToken = default) =>
        _context.Disputes.AnyAsync(d => d.SubmissionId == submissionId && DisputeStates.Active.Contains(d.Status), cancellationToken);

    public async Task AddAsync(Dispute dispute, CancellationToken cancellationToken = default) =>
        await _context.Disputes.AddAsync(dispute, cancellationToken);

    public async Task<IReadOnlyList<Dispute>> GetRaisedByAsync(Guid userId, string? status, CancellationToken cancellationToken = default)
    {
        var query = _context.Disputes.AsNoTracking().Where(d => d.RaisedBy == userId);
        if (status != null)
        {
            query = query.Where(d => d.Status == status);
        }

        return await query
            .Include(d => d.Submission!).ThenInclude(s => s.Job)
            .Include(d => d.Submission!).ThenInclude(s => s.Candidate)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<(IReadOnlyList<Dispute> Items, int TotalCount)> GetPageAsync(
        string? status, string? type, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _context.Disputes.AsNoTracking();
        if (status != null)
        {
            query = query.Where(d => d.Status == status);
        }

        if (type != null)
        {
            query = query.Where(d => d.DisputeType == type);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(d => d.Submission!).ThenInclude(s => s.Job)
            .Include(d => d.Submission!).ThenInclude(s => s.Candidate)
            // Open disputes first, oldest first: that is the Admin's work queue.
            .OrderBy(d => DisputeStates.Active.Contains(d.Status) ? 0 : 1)
            .ThenBy(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, total);
    }

    public Task<Dispute?> GetForUpdateAsync(Guid disputeId, CancellationToken cancellationToken = default) =>
        _context.Disputes
            .Include(d => d.Submission!).ThenInclude(s => s.Job)
            .Include(d => d.Submission!).ThenInclude(s => s.Candidate)
            .FirstOrDefaultAsync(d => d.DisputeId == disputeId, cancellationToken);

    public async Task<IReadOnlyList<Submission>> GetSubmissionsForCandidateJobAsync(
        Guid candidateId, Guid jobId, CancellationToken cancellationToken = default) =>
        await _context.Submissions.AsNoTracking()
            .Include(s => s.Consent)
            .Where(s => s.CandidateId == candidateId && s.JobId == jobId)
            .OrderBy(s => s.SubmittedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, string?>> GetAffiliateNamesByUserIdsAsync(
        IEnumerable<Guid> userIds, CancellationToken cancellationToken = default)
    {
        var ids = userIds.Distinct().ToList();
        return await _context.AffiliateProfiles.AsNoTracking()
            .Where(a => ids.Contains(a.UserId))
            .ToDictionaryAsync(a => a.UserId, a => a.DisplayName ?? a.User.DisplayName, cancellationToken);
    }
}
