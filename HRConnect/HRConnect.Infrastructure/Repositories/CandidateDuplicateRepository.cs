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
