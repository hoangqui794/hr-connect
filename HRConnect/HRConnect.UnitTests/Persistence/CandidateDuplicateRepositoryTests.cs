using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRConnect.UnitTests.Persistence;

public sealed class CandidateDuplicateRepositoryTests
{
    [Fact]
    public async Task FindStrongCvNameMatchAsync_ExactCvAndName_ReturnsCandidateAndSameJobHistory()
    {
        await using var context = CreateContext();
        var candidate = CreateCandidate("Existing Candidate");
        var jobId = Guid.NewGuid();
        var cv = CreateCv(candidate.CandidateId, "hash-1");
        var submission = CreateSubmission(candidate.CandidateId, cv.CvId, jobId);
        context.AddRange(candidate, cv, submission, new SubmissionIdentitySnapshot
        {
            SubmissionId = submission.SubmissionId,
            NormalizedNameHash = "name-hmac",
            CvContentSha256 = "hash-1",
            CapturedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var result = await new CandidateDuplicateRepository(context).FindStrongCvNameMatchAsync(
            Guid.NewGuid(), jobId, "name-hmac", "hash-1");

        result.Should().NotBeNull();
        result!.CandidateId.Should().Be(candidate.CandidateId);
        result.SubmissionId.Should().Be(submission.SubmissionId);
        result.HasSameJobHistory.Should().BeTrue();
    }

    [Fact]
    public async Task FindStrongCvNameMatchAsync_SameCvButDifferentName_DoesNotFlagTemplateReuse()
    {
        await using var context = CreateContext();
        var candidate = CreateCandidate("Different Person");
        var jobId = Guid.NewGuid();
        var cv = CreateCv(candidate.CandidateId, "shared-template-hash");
        var submission = CreateSubmission(candidate.CandidateId, cv.CvId, jobId);
        context.AddRange(candidate, cv, submission, new SubmissionIdentitySnapshot
        {
            SubmissionId = submission.SubmissionId,
            NormalizedNameHash = "different-name-hmac",
            CvContentSha256 = "shared-template-hash",
            CapturedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var result = await new CandidateDuplicateRepository(context).FindStrongCvNameMatchAsync(
            Guid.NewGuid(), jobId, "current-name-hmac", "shared-template-hash");

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetActiveSameJobCaseForSubmissionAsync_MatchesEitherCandidateOnSameJob()
    {
        await using var context = CreateContext();
        var candidateA = CreateCandidate("Candidate A");
        var candidateB = CreateCandidate("Candidate B");
        var jobId = Guid.NewGuid();
        var cvA = CreateCv(candidateA.CandidateId, "hash-a");
        var cvB = CreateCv(candidateB.CandidateId, "hash-b");
        var firstSubmission = CreateSubmission(candidateA.CandidateId, cvA.CvId, jobId);
        var currentSubmission = CreateSubmission(candidateB.CandidateId, cvB.CvId, jobId);
        var duplicateCase = new CandidateDuplicateCase
        {
            DuplicateCaseId = Guid.NewGuid(),
            CandidateAId = candidateA.CandidateId,
            CandidateBId = candidateB.CandidateId,
            SubmissionId = firstSubmission.SubmissionId,
            JobId = jobId,
            RiskLevel = "HIGH",
            Status = "AWAITING_CANDIDATE",
            IdempotencyKey = Guid.NewGuid().ToString("N"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.AddRange(candidateA, candidateB, cvA, cvB, firstSubmission, currentSubmission, duplicateCase);
        await context.SaveChangesAsync();

        var result = await new CandidateDuplicateRepository(context)
            .GetActiveSameJobCaseForSubmissionAsync(currentSubmission.SubmissionId);

        result.Should().NotBeNull();
        result!.DuplicateCaseId.Should().Be(duplicateCase.DuplicateCaseId);
    }

    private static ApplicationDbContext CreateContext() => new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Candidate CreateCandidate(string name) => new()
    {
        CandidateId = Guid.NewGuid(),
        FullName = name,
        ProfileVisibility = "PRIVATE",
        Status = "ACTIVE",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static CandidateCv CreateCv(Guid candidateId, string hash) => new()
    {
        CvId = Guid.NewGuid(),
        CandidateId = candidateId,
        Title = "CV",
        CreationMethod = "AFFILIATE_UPLOAD",
        Status = "ACTIVE",
        ContentSha256 = hash,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static Submission CreateSubmission(Guid candidateId, Guid cvId, Guid jobId) => new()
    {
        SubmissionId = Guid.NewGuid(),
        CandidateId = candidateId,
        CvId = cvId,
        JobId = jobId,
        SubmittedBy = Guid.NewGuid(),
        Source = "AFFILIATE",
        Status = "PENDING_CONSENT",
        SubmittedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };
}
