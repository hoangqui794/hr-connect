using System.Text.Json;
using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Presentation.Endpoints.Internal;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Endpoints.Internal;

public class AiResultCallbackProcessorTests
{
    [Fact]
    public async Task ProcessAsync_CompletedCallback_PersistsSafeResultParsedCvAndAudit()
    {
        await using var db = CreateContext();
        var fixture = await SeedAttemptAsync(db);
        var payload = CreateCallback(fixture, "COMPLETED", 82m);

        await AiResultCallbackProcessor.ProcessAsync(payload, db, CancellationToken.None);

        var result = await db.AiMatchResults.SingleAsync();
        result.Status.Should().Be("COMPLETED");
        result.MatchScore.Should().Be(82m);
        result.MatchTier.Should().Be("HIGH");
        result.ModelVersion.Should().Be("BAAI/bge-m3");
        result.RawResponse.Should().NotContain("structuredCvData");
        result.RawResponse.Should().NotContain("private@example.com");
        (await db.CandidateCvs.SingleAsync()).ParsedData.Should().Contain("private@example.com");

        var audit = await db.AuditLogs.SingleAsync();
        audit.Action.Should().Be("AI_SCORING_COMPLETED");
        audit.EntityId.Should().Be(fixture.ApplicationId);
        audit.CorrelationId.Should().Be(fixture.RequestId);
    }

    [Fact]
    public async Task ProcessAsync_DuplicateCompletedCallback_IsIdempotent()
    {
        await using var db = CreateContext();
        var fixture = await SeedAttemptAsync(db);
        var payload = CreateCallback(fixture, "COMPLETED", 82m);

        await AiResultCallbackProcessor.ProcessAsync(payload, db, CancellationToken.None);
        var firstCompletedAt = (await db.AiMatchResults.SingleAsync()).CompletedAt;
        await AiResultCallbackProcessor.ProcessAsync(payload, db, CancellationToken.None);

        (await db.AuditLogs.CountAsync()).Should().Be(1);
        (await db.AiMatchResults.SingleAsync()).CompletedAt.Should().Be(firstCompletedAt);
    }

    [Fact]
    public async Task ProcessAsync_FailedCallbackAfterCompleted_DoesNotDowngradeTerminalResult()
    {
        await using var db = CreateContext();
        var fixture = await SeedAttemptAsync(db);
        await AiResultCallbackProcessor.ProcessAsync(
            CreateCallback(fixture, "COMPLETED", 82m), db, CancellationToken.None);

        await AiResultCallbackProcessor.ProcessAsync(
            CreateCallback(fixture, "FAILED", null), db, CancellationToken.None);

        var result = await db.AiMatchResults.SingleAsync();
        result.Status.Should().Be("COMPLETED");
        result.FailureCode.Should().BeNull();
        (await db.AuditLogs.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task ProcessAsync_FailedCallback_PersistsFailureCodeAndAudit()
    {
        await using var db = CreateContext();
        var fixture = await SeedAttemptAsync(db);

        await AiResultCallbackProcessor.ProcessAsync(
            CreateCallback(fixture, "FAILED", null), db, CancellationToken.None);

        var result = await db.AiMatchResults.SingleAsync();
        result.Status.Should().Be("FAILED");
        result.FailureCode.Should().Be("OCR_FAILED");
        result.ErrorMessage.Should().Be("Unable to read CV");
        (await db.AuditLogs.SingleAsync()).Action.Should().Be("AI_SCORING_FAILED");
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task<AttemptFixture> SeedAttemptAsync(ApplicationDbContext db)
    {
        var fixture = new AttemptFixture(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(),
            CvId = fixture.CvId,
            JobId = fixture.JobId,
            CandidateId = Guid.NewGuid(),
            SubmittedBy = Guid.NewGuid(),
            Source = "CANDIDATE",
            Status = "ACCEPTED"
        };
        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = fixture.ApplicationId,
            JobId = fixture.JobId,
            CandidateId = submission.CandidateId,
            AcceptedSubmissionId = submission.SubmissionId,
            Status = "SUBMITTED",
            Submission = submission
        };
        db.CandidateCvs.Add(new CandidateCv
        {
            CvId = fixture.CvId,
            CandidateId = submission.CandidateId,
            Title = "CV",
            CreationMethod = "FILE_UPLOAD",
            Status = "ACTIVE"
        });
        db.Submissions.Add(submission);
        db.Applications.Add(application);
        db.AiMatchResults.Add(new AiMatchResult
        {
            MatchResultId = fixture.RequestId,
            ApplicationId = fixture.ApplicationId,
            AttemptNo = 1,
            ExternalReference = fixture.RequestId.ToString(),
            Status = "PROCESSING",
            RequestedAt = DateTime.UtcNow,
            Application = application
        });
        db.MatchTierConfigs.Add(new MatchTierConfig
        {
            TierCode = "HIGH",
            DisplayName = "High",
            MinScore = 80,
            MaxScore = 100,
            ColorCode = "#00AA00",
            DisplayOrder = 1,
            IsActive = true
        });
        await db.SaveChangesAsync();
        return fixture;
    }

    private static AiResultCallback CreateCallback(AttemptFixture fixture, string status, decimal? score)
    {
        using var structured = JsonDocument.Parse("""{"email":"private@example.com","skills":["C#"]}""");
        using var highlights = JsonDocument.Parse("""["Strong backend experience"]""");
        return new AiResultCallback(
            fixture.RequestId.ToString(),
            fixture.ApplicationId,
            fixture.CvId,
            fixture.JobId,
            1,
            status,
            score,
            highlights.RootElement.Clone(),
            null,
            null,
            structured.RootElement.Clone(),
            "BAAI/bge-m3",
            status == "FAILED" ? "OCR_FAILED" : null,
            status == "FAILED" ? "Unable to read CV" : null);
    }

    private sealed record AttemptFixture(Guid ApplicationId, Guid CvId, Guid JobId, Guid RequestId);
}
