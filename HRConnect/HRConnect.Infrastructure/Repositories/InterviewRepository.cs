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

public class InterviewRepository : IInterviewRepository
{
    private readonly ApplicationDbContext _context;

    public InterviewRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(IReadOnlyList<Interview> Items, int TotalCount)> GetInterviewsAsync(
        Guid? companyId,
        Guid? candidateUserId,
        Guid? jobId,
        Guid? applicationId,
        Guid? interviewerId,
        string? status,
        string? result,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Interviews.AsNoTracking();

        if (companyId.HasValue && companyId.Value != Guid.Empty)
        {
            query = query.Where(i => i.Application.Job.CompanyId == companyId.Value);
        }

        if (candidateUserId.HasValue && candidateUserId.Value != Guid.Empty)
        {
            query = query.Where(i => i.Application.Candidate.UserId == candidateUserId.Value);
        }

        if (jobId.HasValue && jobId.Value != Guid.Empty)
        {
            query = query.Where(i => i.Application.JobId == jobId.Value);
        }

        if (applicationId.HasValue && applicationId.Value != Guid.Empty)
        {
            query = query.Where(i => i.ApplicationId == applicationId.Value);
        }

        if (interviewerId.HasValue && interviewerId.Value != Guid.Empty)
        {
            query = query.Where(i => i.InterviewParticipants.Any(p => p.UserId == interviewerId.Value));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpperInvariant();
            query = query.Where(i => i.Status == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(result))
        {
            var normalizedResult = result.Trim().ToUpperInvariant();
            query = query.Where(i => i.Result == normalizedResult);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(i => i.ScheduledAt >= fromDate.Value || (i.ScheduledAt == null && i.CreatedAt >= fromDate.Value));
        }

        if (toDate.HasValue)
        {
            query = query.Where(i => i.ScheduledAt <= toDate.Value || (i.ScheduledAt == null && i.CreatedAt <= toDate.Value));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(i => i.Application)
                .ThenInclude(a => a.Job)
                    .ThenInclude(j => j.Company)
            .Include(i => i.Application)
                .ThenInclude(a => a.Candidate)
            .Include(i => i.InterviewParticipants)
                .ThenInclude(p => p.User)
            .Include(i => i.CreatedByNavigation)
            .Include(i => i.RecordedByNavigation)
            .OrderByDescending(i => i.ScheduledAt ?? i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<Interview?> GetByIdAsync(Guid interviewId, CancellationToken cancellationToken = default)
    {
        return await _context.Interviews
            .FirstOrDefaultAsync(i => i.InterviewId == interviewId, cancellationToken);
    }

    public async Task<Interview?> GetByIdWithDetailsAsync(Guid interviewId, CancellationToken cancellationToken = default)
    {
        return await _context.Interviews
            .AsNoTracking()
            .Include(i => i.Application)
                .ThenInclude(a => a.Job)
                    .ThenInclude(j => j.Company)
            .Include(i => i.Application)
                .ThenInclude(a => a.Candidate)
            .Include(i => i.InterviewParticipants)
                .ThenInclude(p => p.User)
            .Include(i => i.InterviewStatusHistories)
                .ThenInclude(h => h.ChangedByNavigation)
            .Include(i => i.CreatedByNavigation)
            .Include(i => i.RecordedByNavigation)
            .AsSplitQuery()
            .FirstOrDefaultAsync(i => i.InterviewId == interviewId, cancellationToken);
    }

    public async Task<Interview?> GetByIdForUpdateAsync(Guid interviewId, CancellationToken cancellationToken = default)
    {
        return await _context.Interviews
            .Include(i => i.Application)
                .ThenInclude(a => a.Job)
            .Include(i => i.InterviewParticipants)
            .Include(i => i.InterviewStatusHistories)
            .FirstOrDefaultAsync(i => i.InterviewId == interviewId, cancellationToken);
    }

    public async Task AddAsync(Interview interview, CancellationToken cancellationToken = default)
    {
        await _context.Interviews.AddAsync(interview, cancellationToken);
    }

    public void Update(Interview interview)
    {
        _context.Interviews.Update(interview);
    }
}
