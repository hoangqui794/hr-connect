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
            .Include(a => a.Job)
                .ThenInclude(j => j.Company)
            .Include(a => a.Candidate)
            .Include(a => a.Interviews)
            .Include(a => a.Attribution)
            .Include(a => a.Submission)
            .Include(a => a.ApplicationStatusHistories)
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId, cancellationToken);
    }

    public async Task<JobApplication?> GetByIdWithDetailsAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.Applications
            .AsNoTracking()
            .Include(a => a.Job)
                .ThenInclude(j => j.Company)
            .Include(a => a.Candidate)
            .Include(a => a.Submission)
                .ThenInclude(s => s!.CandidateCv)
            .Include(a => a.AiMatchResults)
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId, cancellationToken);
    }

    public async Task<(IReadOnlyList<JobApplication> Items, int TotalCount)> GetCandidateApplicationsAsync(
        Guid candidateId,
        string? status,
        Guid? jobId,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Applications
            .AsNoTracking()
            .Where(a => a.CandidateId == candidateId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpper();
            query = query.Where(a => a.Status == normalizedStatus);
        }

        if (jobId.HasValue && jobId.Value != Guid.Empty)
        {
            query = query.Where(a => a.JobId == jobId.Value);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(a => a.AppliedAt >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(a => a.AppliedAt <= toDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(a => a.Job)
                .ThenInclude(j => j.Company)
            .Include(a => a.Submission)
                .ThenInclude(s => s!.CandidateCv)
            .Include(a => a.AiMatchResults)
            .OrderByDescending(a => a.AppliedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<(IReadOnlyList<JobApplication> Items, int TotalCount)> GetRecruitmentApplicationsAsync(
        Guid? companyId,
        Guid? jobId,
        string? status,
        string? candidateName,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Applications.AsNoTracking();

        if (companyId.HasValue && companyId.Value != Guid.Empty)
        {
            query = query.Where(a => a.Job.CompanyId == companyId.Value);
        }

        if (jobId.HasValue && jobId.Value != Guid.Empty)
        {
            query = query.Where(a => a.JobId == jobId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpper();
            query = query.Where(a => a.Status == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(candidateName))
        {
            var pattern = $"%{candidateName.Trim()}%";
            query = query.Where(a => EF.Functions.ILike(a.Candidate.FullName, pattern)
                || (a.Candidate.Email != null && EF.Functions.ILike(a.Candidate.Email, pattern)));
        }

        if (fromDate.HasValue)
        {
            query = query.Where(a => a.AppliedAt >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(a => a.AppliedAt <= toDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(a => a.Job)
                .ThenInclude(j => j.Company)
            .Include(a => a.Candidate)
            .Include(a => a.Interviews)
            .Include(a => a.Offers)
            .Include(a => a.AiMatchResults)
            .Include(a => a.Submission)
                .ThenInclude(s => s!.CandidateCv)
            .OrderByDescending(a => a.AppliedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<JobApplication?> GetRecruitmentApplicationDetailAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.Applications
            .AsNoTracking()
            .Include(a => a.Job)
                .ThenInclude(j => j.Company)
            .Include(a => a.Candidate)
            .Include(a => a.Submission)
                .ThenInclude(s => s!.CandidateCv)
            .Include(a => a.AiMatchResults)
            .Include(a => a.Interviews)
                .ThenInclude(i => i.InterviewParticipants)
            .Include(a => a.Interviews)
                .ThenInclude(i => i.CreatedByNavigation)
            .Include(a => a.Interviews)
                .ThenInclude(i => i.RecordedByNavigation)
            .Include(a => a.Offers)
                .ThenInclude(o => o.CreatedByNavigation)
            .Include(a => a.Placement)
                .ThenInclude(p => p!.ConfirmedByNavigation)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId, cancellationToken);
    }

    public async Task<JobApplication?> GetApplicationTimelineDataAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.Applications
            .AsNoTracking()
            .Include(a => a.Job)
                .ThenInclude(j => j.Company)
            .Include(a => a.Candidate)
            .Include(a => a.ApplicationStatusHistories)
                .ThenInclude(h => h.ChangedByNavigation)
            .Include(a => a.Interviews)
                .ThenInclude(i => i.InterviewStatusHistories)
                    .ThenInclude(h => h.ChangedByNavigation)
            .Include(a => a.Interviews)
                .ThenInclude(i => i.CreatedByNavigation)
            .Include(a => a.Interviews)
                .ThenInclude(i => i.RecordedByNavigation)
            .Include(a => a.Offers)
                .ThenInclude(o => o.CreatedByNavigation)
            .Include(a => a.Placement)
                .ThenInclude(p => p!.ConfirmedByNavigation)
            .AsSplitQuery()
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
