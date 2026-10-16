using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Application.Features.Candidates.Common;
using HRConnect.Domain.Constants;
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
            .Include(a => a.Job)
                .ThenInclude(j => j.ServiceType)
            .Include(a => a.ReplacementSlot)
            .Include(a => a.Candidate)
            .Include(a => a.Interviews)
                .ThenInclude(i => i.InterviewStatusHistories)
            .Include(a => a.Offers)
            .Include(a => a.Attribution)
                .ThenInclude(attribution => attribution!.Affiliate)
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
            .Include(a => a.Offers)
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
        CancellationToken cancellationToken = default) =>
        await GetCandidateApplicationsFilteredAsync(
            candidateId, status, jobId, fromDate, toDate, null, null, page, pageSize, cancellationToken);

    public async Task<(IReadOnlyList<JobApplication> Items, int TotalCount)> GetCandidateApplicationsFilteredAsync(
        Guid candidateId,
        string? status,
        Guid? jobId,
        DateTime? fromDate,
        DateTime? toDate,
        string? search,
        string? submissionSource,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Applications
            .AsNoTracking()
            .Where(a => a.CandidateId == candidateId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var displayGroup = status.Trim().ToUpperInvariant();
            var internalStatuses = CandidateApplicationDisplayStatusMapper
                .GetInternalStatuses(displayGroup)
                .ToArray();
            query = query.Where(a => internalStatuses.Contains(a.Status));
            if (displayGroup == "OFFER")
            {
                query = query.Where(a => a.Offers.Any(offer => offer.Status == OfferStates.Sent));
            }
            else if (displayGroup == "IN_REVIEW")
            {
                query = query.Where(a =>
                    a.Status != ApplicationStates.OfferPending ||
                    !a.Offers.Any(offer => offer.Status == OfferStates.Sent));
            }
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

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(a => EF.Functions.ILike(a.Job.Title, pattern) ||
                                     EF.Functions.ILike(a.Job.Company.CompanyName, pattern));
        }

        if (!string.IsNullOrWhiteSpace(submissionSource))
        {
            query = query.Where(a => a.Submission != null && a.Submission.Source == submissionSource);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(a => a.Job)
                .ThenInclude(j => j.Company)
            .Include(a => a.Job)
                .ThenInclude(j => j.ServiceType)
            .Include(a => a.Submission)
                .ThenInclude(s => s!.CandidateCv)
            .Include(a => a.AiMatchResults)
            .Include(a => a.Offers)
            .OrderByDescending(a => a.AppliedAt)
            .ThenByDescending(a => a.ApplicationId)
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
        CancellationToken cancellationToken = default,
        string? sortBy = null,
        string? sortDirection = null)
    {
        var query = _context.Applications.AsNoTracking();

        if (companyId.HasValue && companyId.Value != Guid.Empty)
        {
            // Company-scoped listing is the Client view: hide platform-screened applications
            // until Internal HR shortlists them (MF-03).
            query = query
                .Where(a => a.Job.CompanyId == companyId.Value)
                .Where(ClientVisibilityPolicy.IsVisibleToClientExpression);
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

        var scoreDescending = !string.Equals(sortDirection?.Trim(), "ASC", StringComparison.OrdinalIgnoreCase);
        var orderedQuery = string.Equals(sortBy?.Trim(), "AI_MATCH_SCORE", StringComparison.OrdinalIgnoreCase)
            ? scoreDescending
                ? query.OrderByDescending(a => a.AiMatchResults
                    .OrderByDescending(result => result.AttemptNo)
                    .Select(result => result.MatchScore)
                    .FirstOrDefault())
                    .ThenByDescending(a => a.AppliedAt)
                : query.OrderBy(a => a.AiMatchResults
                    .OrderByDescending(result => result.AttemptNo)
                    .Select(result => result.MatchScore)
                    .FirstOrDefault())
                    .ThenByDescending(a => a.AppliedAt)
            : query.OrderByDescending(a => a.AppliedAt);

        var items = await orderedQuery
            .Include(a => a.Job)
                .ThenInclude(j => j.Company)
            .Include(a => a.Job)
                .ThenInclude(j => j.ServiceType)
            .Include(a => a.ReplacementSlot)
            .Include(a => a.Candidate)
            .Include(a => a.Interviews)
            .Include(a => a.Offers)
            .Include(a => a.AiMatchResults)
            .Include(a => a.Submission)
                .ThenInclude(s => s!.CandidateCv)
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
            .Include(a => a.Job)
                .ThenInclude(j => j.ServiceType)
            .Include(a => a.Candidate)
            .Include(a => a.Submission)
                .ThenInclude(s => s!.CandidateCv)
            .Include(a => a.AiMatchResults)
            .Include(a => a.ApplicationStatusHistories)
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
            .Include(a => a.Placement)
                .ThenInclude(p => p!.ReplacementSlot)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId, cancellationToken);
    }

    public async Task<JobApplication?> GetApplicationTimelineDataAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.Applications
            .AsNoTracking()
            .Include(a => a.Job)
                .ThenInclude(j => j.Company)
            .Include(a => a.Job)
                .ThenInclude(j => j.ServiceType)
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

    public Task<bool> ExistsForCandidateAndCompanySinceAsync(
        Guid candidateId,
        Guid companyId,
        DateTime sinceUtc,
        CancellationToken cancellationToken = default)
    {
        return _context.Applications
            .AsNoTracking()
            .AnyAsync(application =>
                    application.CandidateId == candidateId &&
                    application.Job.CompanyId == companyId &&
                    application.AppliedAt >= sinceUtc,
                cancellationToken);
    }

    public async Task AddAsync(JobApplication application, CancellationToken cancellationToken = default)
    {
        await _context.Applications.AddAsync(application, cancellationToken);
    }

    public void Update(JobApplication application)
    {
        var entry = _context.Entry(application);
        if (entry.State == EntityState.Detached)
        {
            _context.Applications.Update(application);
        }
        else
        {
            foreach (var history in application.ApplicationStatusHistories)
            {
                var hEntry = _context.Entry(history);
                if (hEntry.State == EntityState.Detached)
                {
                    hEntry.State = EntityState.Added;
                }
            }
        }
    }
}
