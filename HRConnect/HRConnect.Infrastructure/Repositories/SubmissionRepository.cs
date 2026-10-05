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

    public Task<Submission?> GetPendingConsentSubmissionAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default)
    {
        return _context.Submissions
            .Include(s => s.Consent)
            .Include(s => s.CandidateCv)
            .FirstOrDefaultAsync(s => s.CandidateId == candidateId && s.JobId == jobId &&
                                      s.Status == "PENDING_CONSENT",
                cancellationToken);
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
                .ThenInclude(job => job.Company)
            .Include(s => s.Candidate)
            .Include(s => s.Applications)
            .Include(s => s.Attribution)
            .Include(s => s.Consent)
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
            .Include(s => s.Consent)
            .FirstOrDefaultAsync(s => s.SubmissionId == submissionId, cancellationToken);
    }

    public async Task<(IReadOnlyList<AffiliateCandidateLibraryRecord> Items, int TotalCount)> GetAffiliateCandidateLibraryAsync(
        Guid userId,
        string? search,
        string sortBy,
        string sortDirection,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Candidates
            .AsNoTracking()
            .Where(candidate =>
                candidate.Status == "ACTIVE" &&
                candidate.MergedIntoCandidateId == null &&
                candidate.CandidateCvs.Any(cv =>
                    cv.CreationMethod == "AFFILIATE_UPLOAD" &&
                    cv.UploadedByUserId == userId &&
                    cv.Status == "ACTIVE" &&
                    cv.Submissions.Any(submission =>
                        submission.SubmittedBy == userId && submission.Status == "ACCEPTED")));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(candidate =>
                EF.Functions.ILike(candidate.FullName, pattern) ||
                (candidate.Email != null && EF.Functions.ILike(candidate.Email, pattern)) ||
                (candidate.Phone != null && EF.Functions.ILike(candidate.Phone, pattern)));
        }

        var projected = query.Select(candidate => new
        {
            candidate.CandidateId,
            candidate.FullName,
            candidate.Email,
            candidate.Phone,
            HasAccount = candidate.UserId.HasValue,
            ActiveCvCount = candidate.CandidateCvs.Count(cv =>
                cv.CreationMethod == "AFFILIATE_UPLOAD" &&
                cv.UploadedByUserId == userId &&
                cv.Status == "ACTIVE" &&
                cv.Submissions.Any(submission =>
                    submission.SubmittedBy == userId && submission.Status == "ACCEPTED")),
            AcceptedSubmissionCount = candidate.Submissions.Count(submission =>
                submission.SubmittedBy == userId && submission.Status == "ACCEPTED"),
            LastSubmittedAt = candidate.Submissions
                .Where(submission => submission.SubmittedBy == userId && submission.Status == "ACCEPTED")
                .Select(submission => (DateTime?)submission.SubmittedAt)
                .Max()
        });

        var totalCount = await projected.CountAsync(cancellationToken);
        var ascending = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        projected = string.Equals(sortBy, "candidateName", StringComparison.OrdinalIgnoreCase)
            ? ascending
                ? projected.OrderBy(item => item.FullName).ThenBy(item => item.CandidateId)
                : projected.OrderByDescending(item => item.FullName).ThenBy(item => item.CandidateId)
            : ascending
                ? projected.OrderBy(item => item.LastSubmittedAt).ThenBy(item => item.CandidateId)
                : projected.OrderByDescending(item => item.LastSubmittedAt).ThenBy(item => item.CandidateId);

        var items = await projected
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(item => new AffiliateCandidateLibraryRecord(
                item.CandidateId,
                item.FullName,
                item.Email,
                item.Phone,
                item.HasAccount,
                item.ActiveCvCount,
                item.AcceptedSubmissionCount,
                item.LastSubmittedAt))
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<AffiliateCandidateLibraryDetailRecord?> GetAffiliateCandidateLibraryDetailAsync(
        Guid userId,
        Guid candidateId,
        CancellationToken cancellationToken = default)
    {
        var candidate = await _context.Candidates
            .AsNoTracking()
            .Where(candidate =>
                candidate.CandidateId == candidateId &&
                candidate.Status == "ACTIVE" &&
                candidate.MergedIntoCandidateId == null &&
                candidate.CandidateCvs.Any(cv =>
                    cv.CreationMethod == "AFFILIATE_UPLOAD" &&
                    cv.UploadedByUserId == userId &&
                    cv.Status == "ACTIVE" &&
                    cv.Submissions.Any(submission =>
                        submission.SubmittedBy == userId && submission.Status == "ACCEPTED")))
            .Select(candidate => new
            {
                candidate.CandidateId,
                candidate.FullName,
                candidate.Email,
                candidate.Phone,
                HasAccount = candidate.UserId.HasValue,
                AcceptedSubmissionCount = candidate.Submissions.Count(submission =>
                    submission.SubmittedBy == userId && submission.Status == "ACCEPTED")
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (candidate is null)
            return null;

        var cvRows = await _context.CandidateCvs
            .AsNoTracking()
            .Where(cv =>
                cv.CandidateId == candidateId &&
                cv.CreationMethod == "AFFILIATE_UPLOAD" &&
                cv.UploadedByUserId == userId &&
                cv.Status == "ACTIVE" &&
                cv.Submissions.Any(submission =>
                    submission.SubmittedBy == userId && submission.Status == "ACCEPTED"))
            .OrderByDescending(cv => cv.UpdatedAt)
            .Select(cv => new
            {
                cv.CvId,
                cv.Title,
                cv.FileName,
                cv.MimeType,
                cv.FileSizeBytes,
                cv.Status,
                cv.CreatedAt,
                AcceptedSubmissionCount = cv.Submissions.Count(submission =>
                    submission.SubmittedBy == userId && submission.Status == "ACCEPTED"),
                LastUsedAt = cv.Submissions
                    .Where(submission => submission.SubmittedBy == userId && submission.Status == "ACCEPTED")
                    .Select(submission => (DateTime?)submission.SubmittedAt)
                    .Max()
            })
            .ToListAsync(cancellationToken);

        var cvs = cvRows
            .Select(cv => new AffiliateCandidateCvRecord(
                cv.CvId,
                cv.Title,
                cv.FileName,
                cv.MimeType,
                cv.FileSizeBytes,
                cv.Status,
                cv.CreatedAt,
                cv.AcceptedSubmissionCount,
                cv.LastUsedAt))
            .ToList();

        return new AffiliateCandidateLibraryDetailRecord(
            candidate.CandidateId,
            candidate.FullName,
            candidate.Email,
            candidate.Phone,
            candidate.HasAccount,
            candidate.AcceptedSubmissionCount,
            cvs);
    }

    public async Task<AffiliateCandidateCvAccessRecord?> GetAffiliateCandidateCvAccessAsync(
        Guid userId,
        Guid candidateId,
        Guid cvId,
        CancellationToken cancellationToken = default)
    {
        return await _context.CandidateCvs
            .AsNoTracking()
            .Where(cv =>
                cv.CvId == cvId &&
                cv.CandidateId == candidateId &&
                cv.Candidate.Status == "ACTIVE" &&
                cv.Candidate.MergedIntoCandidateId == null &&
                cv.CreationMethod == "AFFILIATE_UPLOAD" &&
                cv.UploadedByUserId == userId &&
                cv.Status == "ACTIVE" &&
                cv.Submissions.Any(submission =>
                    submission.SubmittedBy == userId && submission.Status == "ACCEPTED"))
            .Select(cv => new AffiliateCandidateCvAccessRecord(
                cv.CandidateId,
                cv.CvId,
                cv.FileName))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<(IReadOnlyList<CandidateAffiliateCvRecord> Items, int TotalCount)> GetCandidateAffiliateCvsAsync(
        Guid candidateId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query =
            from cv in _context.CandidateCvs.AsNoTracking()
            join affiliateUser in _context.AppUsers.AsNoTracking()
                on cv.UploadedByUserId equals affiliateUser.UserId
            where cv.CandidateId == candidateId &&
                  cv.CreationMethod == "AFFILIATE_UPLOAD" &&
                  cv.Status != "DELETED" &&
                  cv.Submissions.Any()
            select new
            {
                cv.CvId,
                cv.Title,
                cv.FileName,
                cv.MimeType,
                cv.FileSizeBytes,
                DocumentStatus = cv.Status,
                AffiliateReuseStatus = cv.AffiliateReuseStatus ?? "NOT_GRANTED",
                ReuseConcurrencyToken = cv.AffiliateReuseConcurrencyToken,
                AffiliateUserId = affiliateUser.UserId,
                AffiliateDisplayName = affiliateUser.DisplayName,
                SubmissionCount = cv.Submissions.Count,
                PendingConsentCount = cv.Submissions.Count(submission => submission.Status == "PENDING_CONSENT"),
                AcceptedSubmissionCount = cv.Submissions.Count(submission => submission.Status == "ACCEPTED"),
                LastSubmittedAt = cv.Submissions.Select(submission => (DateTime?)submission.SubmittedAt).Max(),
                cv.CreatedAt
            };

        var totalCount = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(item => item.LastSubmittedAt)
            .ThenByDescending(item => item.CreatedAt)
            .ThenBy(item => item.CvId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (rows.Select(item => new CandidateAffiliateCvRecord(
            item.CvId,
            item.Title,
            item.FileName,
            item.MimeType,
            item.FileSizeBytes,
            item.DocumentStatus,
            item.AffiliateReuseStatus,
            item.ReuseConcurrencyToken,
            item.AffiliateUserId,
            item.AffiliateDisplayName,
            item.SubmissionCount,
            item.PendingConsentCount,
            item.AcceptedSubmissionCount,
            item.LastSubmittedAt,
            item.CreatedAt)).ToList(), totalCount);
    }
}
