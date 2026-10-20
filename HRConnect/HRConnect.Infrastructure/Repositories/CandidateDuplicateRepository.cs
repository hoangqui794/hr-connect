using System.Text.Json;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class CandidateDuplicateRepository : ICandidateDuplicateRepository
{
    private static readonly string[] ActiveStatuses =
        ["OPEN", "AWAITING_CANDIDATE", "UNDER_REVIEW", "BLOCKED_FINANCE"];

    private readonly ApplicationDbContext _context;

    public CandidateDuplicateRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<CandidateDuplicateMatch?> FindStrongCvNameMatchAsync(
        Guid candidateId,
        Guid jobId,
        string normalizedNameHash,
        string cvContentSha256,
        CancellationToken cancellationToken = default)
    {
        return _context.SubmissionIdentitySnapshots
            .AsNoTracking()
            .Where(snapshot =>
                snapshot.NormalizedNameHash == normalizedNameHash &&
                snapshot.CvContentSha256 == cvContentSha256 &&
                snapshot.Submission.CandidateId != candidateId &&
                snapshot.Submission.Candidate.Status == "ACTIVE" &&
                snapshot.Submission.Candidate.MergedIntoCandidateId == null)
            .OrderBy(snapshot => snapshot.CapturedAt)
            .ThenBy(snapshot => snapshot.SubmissionId)
            .Select(snapshot => new CandidateDuplicateMatch(
                snapshot.Submission.CandidateId,
                snapshot.SubmissionId,
                snapshot.Submission.Candidate.Submissions.Any(submission => submission.JobId == jobId)))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddSnapshotAsync(
        SubmissionIdentitySnapshot snapshot,
        CancellationToken cancellationToken = default)
    {
        await _context.SubmissionIdentitySnapshots.AddAsync(snapshot, cancellationToken);
    }

    public Task<CandidateDuplicateCase?> GetActiveSameJobCaseForSubmissionAsync(
        Guid submissionId,
        CancellationToken cancellationToken = default)
    {
        return _context.CandidateDuplicateCases
            .AsNoTracking()
            .Where(duplicateCase =>
                duplicateCase.JobId != null &&
                ActiveStatuses.Contains(duplicateCase.Status) &&
                _context.Submissions.Any(submission =>
                    submission.SubmissionId == submissionId &&
                    submission.JobId == duplicateCase.JobId &&
                    (submission.CandidateId == duplicateCase.CandidateAId ||
                     submission.CandidateId == duplicateCase.CandidateBId)))
            .OrderBy(duplicateCase => duplicateCase.CreatedAt)
            .ThenBy(duplicateCase => duplicateCase.DuplicateCaseId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<(IReadOnlyList<CandidateDuplicateCase> Items, int TotalCount)> GetReviewPageAsync(
        string? status,
        string? riskLevel,
        Guid? jobId,
        Guid? companyId,
        DateTime? createdFrom,
        DateTime? createdTo,
        string? search,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = _context.CandidateDuplicateCases.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(item => item.Status == status);
        if (!string.IsNullOrWhiteSpace(riskLevel))
            query = query.Where(item => item.RiskLevel == riskLevel);
        if (jobId.HasValue)
            query = query.Where(item => item.JobId == jobId.Value);
        if (companyId.HasValue)
            query = query.Where(item => item.Job != null && item.Job.CompanyId == companyId.Value);
        if (createdFrom.HasValue)
            query = query.Where(item => item.CreatedAt >= createdFrom.Value);
        if (createdTo.HasValue)
            query = query.Where(item => item.CreatedAt <= createdTo.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(item =>
                item.CandidateA.FullName.ToLower().Contains(term) ||
                item.CandidateB.FullName.ToLower().Contains(term) ||
                (item.Job != null && item.Job.Title.ToLower().Contains(term)) ||
                (item.Job != null && item.Job.Company.CompanyName.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(item => item.CandidateA)
            .Include(item => item.CandidateB)
            .Include(item => item.Job).ThenInclude(job => job!.Company)
            .OrderByDescending(item => item.CreatedAt)
            .ThenBy(item => item.DuplicateCaseId)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);
        return (items, totalCount);
    }

    public Task<CandidateDuplicateCase?> GetByIdForReviewAsync(
        Guid duplicateCaseId,
        CancellationToken cancellationToken = default) =>
        _context.CandidateDuplicateCases
            .AsNoTracking()
            .Include(item => item.CandidateA)
            .Include(item => item.CandidateB)
            .Include(item => item.CanonicalCandidate)
            .Include(item => item.Signals)
            .Include(item => item.Job).ThenInclude(job => job!.Company)
            .FirstOrDefaultAsync(item => item.DuplicateCaseId == duplicateCaseId, cancellationToken);

    public Task<CandidateDuplicateCase?> GetByIdForUpdateAsync(
        Guid duplicateCaseId,
        CancellationToken cancellationToken = default) =>
        _context.CandidateDuplicateCases
            .FromSqlInterpolated($"SELECT * FROM public.candidate_duplicate_case WHERE duplicate_case_id = {duplicateCaseId} FOR UPDATE")
            .Include(item => item.CandidateA)
            .Include(item => item.CandidateB)
            .Include(item => item.Signals)
            .Include(item => item.Job).ThenInclude(job => job!.Company)
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<Candidate>> GetCandidatesForUpdateAsync(
        Guid candidateAId,
        Guid candidateBId,
        CancellationToken cancellationToken = default) =>
        await _context.Candidates
            .FromSqlInterpolated($"SELECT * FROM public.candidate WHERE candidate_id IN ({candidateAId}, {candidateBId}) ORDER BY candidate_id FOR UPDATE")
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Submission>> GetRelatedSubmissionsAsync(
        Guid candidateAId,
        Guid candidateBId,
        Guid? jobId,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Submissions
            .AsNoTracking()
            .Where(item => item.CandidateId == candidateAId || item.CandidateId == candidateBId);
        if (jobId.HasValue)
            query = query.Where(item => item.JobId == jobId.Value);

        return await query
            .Include(item => item.Consent)
            .Include(item => item.Job)
            .Include(item => item.Applications)
            .Include(item => item.Attribution).ThenInclude(attribution => attribution!.Commissions)
                .ThenInclude(commission => commission.Payouts)
            .OrderBy(item => item.SubmittedAt)
            .ThenBy(item => item.SubmissionId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Submission>> GetRelatedSubmissionsForUpdateAsync(
        Guid candidateAId,
        Guid candidateBId,
        CancellationToken cancellationToken = default) =>
        await _context.Submissions
            .FromSqlInterpolated($"SELECT * FROM public.submission WHERE candidate_id IN ({candidateAId}, {candidateBId}) ORDER BY submission_id FOR UPDATE")
            .Include(item => item.Consent)
            .Include(item => item.Job)
            .Include(item => item.Applications)
            .Include(item => item.Attribution).ThenInclude(attribution => attribution!.Commissions)
                .ThenInclude(commission => commission.Payouts)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Domain.Entities.Application>> GetCandidateApplicationsAsync(
        Guid candidateAId,
        Guid candidateBId,
        CancellationToken cancellationToken = default) =>
        await _context.Applications
            .AsNoTracking()
            .Where(item => item.CandidateId == candidateAId || item.CandidateId == candidateBId)
            .Include(item => item.Job)
            .Include(item => item.Attribution).ThenInclude(attribution => attribution!.Commissions)
                .ThenInclude(commission => commission.Payouts)
            .OrderBy(item => item.AppliedAt)
            .ThenBy(item => item.ApplicationId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Domain.Entities.Application>> GetCandidateApplicationsForUpdateAsync(
        Guid candidateAId,
        Guid candidateBId,
        CancellationToken cancellationToken = default) =>
        await _context.Applications
            .FromSqlInterpolated($"SELECT * FROM public.application WHERE candidate_id IN ({candidateAId}, {candidateBId}) ORDER BY application_id FOR UPDATE")
            .Include(item => item.Job)
            .Include(item => item.Attribution).ThenInclude(attribution => attribution!.Commissions)
                .ThenInclude(commission => commission.Payouts)
            .ToListAsync(cancellationToken);

    public async Task<CandidateDuplicateCase> GetOrCreateStrongMatchCaseAsync(
        Guid candidateId,
        Guid matchedCandidateId,
        Guid submissionId,
        Guid? jobId,
        string keyVersion,
        DateTime now,
        CancellationToken cancellationToken = default)
    {
        var (candidateAId, candidateBId) = Order(candidateId, matchedCandidateId);
        var scope = jobId?.ToString("N") ?? "global";
        var idempotencyKey = $"strong-cv-name-v1:{candidateAId:N}:{candidateBId:N}:{scope}";
        var caseId = Guid.NewGuid();
        var riskLevel = jobId.HasValue ? "HIGH" : "REVIEW";

        await _context.Database.ExecuteSqlInterpolatedAsync($$"""
            INSERT INTO public.candidate_duplicate_case
                (duplicate_case_id, candidate_a_id, candidate_b_id, submission_id, job_id,
                 risk_level, status, concurrency_token, idempotency_key, created_at, updated_at)
            VALUES
                ({{caseId}}, {{candidateAId}}, {{candidateBId}}, {{submissionId}}, {{jobId}},
                 {{riskLevel}}, 'AWAITING_CANDIDATE', {{Guid.NewGuid()}}, {{idempotencyKey}}, {{now}}, {{now}})
            ON CONFLICT DO NOTHING
            """, cancellationToken);

        var duplicateCase = await _context.CandidateDuplicateCases
            .SingleAsync(item =>
                item.CandidateAId == candidateAId &&
                item.CandidateBId == candidateBId &&
                item.JobId == jobId &&
                ActiveStatuses.Contains(item.Status), cancellationToken);

        var signalId = Guid.NewGuid();
        var evidence = JsonSerializer.Serialize(new
        {
            cv = "exact-binary-sha256",
            name = "normalized-hmac-sha256"
        });

        await _context.Database.ExecuteSqlInterpolatedAsync($$"""
            INSERT INTO public.candidate_duplicate_signal
                (duplicate_signal_id, duplicate_case_id, reason_code, detector_version,
                 score, key_version, evidence, created_at)
            VALUES
                ({{signalId}}, {{duplicateCase.DuplicateCaseId}}, 'EXACT_CV_AND_NORMALIZED_NAME',
                 'sync-v1', 1.0, {{keyVersion}}, CAST({{evidence}} AS jsonb), {{now}})
            ON CONFLICT DO NOTHING
            """, cancellationToken);

        return duplicateCase;
    }

    private static (Guid CandidateAId, Guid CandidateBId) Order(Guid left, Guid right)
    {
        return string.CompareOrdinal(left.ToString("N"), right.ToString("N")) <= 0
            ? (left, right)
            : (right, left);
    }
}
