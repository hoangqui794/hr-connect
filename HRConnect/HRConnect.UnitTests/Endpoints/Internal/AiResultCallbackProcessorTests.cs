using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Presentation.Endpoints.Internal;
using HRConnect.Presentation.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

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
        result.NextAttemptAt.Should().BeNull();
        result.RawResponse.Should().NotContain("structuredCvData");
        result.RawResponse.Should().NotContain("private@example.com");
        result.RawResponse.Should().Contain("ParseConfidence");
        result.RawResponse.Should().Contain("RequiresManualReview");
        result.RawResponse.Should().Contain("InputFingerprints");
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
        result.NextAttemptAt.Should().BeNull();
        (await db.AuditLogs.SingleAsync()).Action.Should().Be("AI_SCORING_FAILED");
    }

    [Fact]
    public async Task PushScoredAsync_SendsEventToStaffAndJobCompanyMembersOnly()
    {
        await using var db = CreateContext();
        var fixture = await SeedAttemptAsync(db);
        var companyId = Guid.NewGuid();
        var hrId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var otherClientId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvAppType = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = ServiceTypeCodes.CvApplication, Name = "CV Application", IsActive = true };
        db.ServiceTypes.Add(cvAppType);
        db.Jobs.Add(new Job { JobId = fixture.JobId, CompanyId = companyId, ServiceTypeId = cvAppType.ServiceTypeId, ServiceType = cvAppType, Title = "Dev", Status = "ACTIVE", CurrencyCode = "VND" });
        var hrRole = new Role { RoleId = Guid.NewGuid(), Code = RoleCodes.InternalHr, Name = "HR", IsActive = true };
        var candidateRole = new Role { RoleId = Guid.NewGuid(), Code = RoleCodes.Candidate, Name = "Candidate", IsActive = true };
        db.Roles.AddRange(hrRole, candidateRole);
        db.UserRoles.AddRange(
            new UserRole { UserId = hrId, RoleId = hrRole.RoleId, Status = UserRoleAssignmentStates.Active, AssignmentSource = "TEST" },
            new UserRole { UserId = candidateId, RoleId = candidateRole.RoleId, Status = UserRoleAssignmentStates.Active, AssignmentSource = "TEST" });
        db.CompanyUsers.AddRange(
            new CompanyUser { CompanyUserId = Guid.NewGuid(), CompanyId = companyId, UserId = clientId, Status = UserAccountStates.Active, RoleInCompany = "OWNER" },
            new CompanyUser { CompanyUserId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), UserId = otherClientId, Status = UserAccountStates.Active, RoleInCompany = "OWNER" });
        await db.SaveChangesAsync();

        var proxy = new Mock<IClientProxy>();
        var clients = new Mock<IHubClients>();
        IReadOnlyList<string>? targeted = null;
        clients.Setup(c => c.Groups(It.IsAny<IReadOnlyList<string>>()))
            .Callback<IReadOnlyList<string>>(g => targeted = g).Returns(proxy.Object);
        var hub = new Mock<IHubContext<NotificationHub>>();
        hub.SetupGet(h => h.Clients).Returns(clients.Object);

        await AiResultCallbackProcessor.PushScoredAsync(
            CreateCallback(fixture, "COMPLETED", 82m), db, hub.Object, NullLogger.Instance, CancellationToken.None);

        targeted.Should().BeEquivalentTo(new[] { NotificationHub.UserGroup(hrId), NotificationHub.UserGroup(clientId) });
        proxy.Verify(p => p.SendCoreAsync("application.scored", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void SelectApplicationScoredRecipients_HeadhuntSubmitted_ExcludesClientAndIncludesStaff()
    {
        var hrId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        var recipients = SignalRNotificationPublisher.SelectApplicationScoredRecipients(
            [hrId, adminId],
            [clientId],
            ServiceTypeCodes.HeadhuntCod,
            ApplicationStates.Submitted,
            [],
            hasSourcingDelivery: false);

        recipients.Should().BeEquivalentTo(new[] { hrId, adminId });
    }

    [Fact]
    public void SelectApplicationScoredRecipients_HeadhuntShortlisted_IncludesClientAndStaff()
    {
        var hrId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        var recipients = SignalRNotificationPublisher.SelectApplicationScoredRecipients(
            [hrId],
            [clientId],
            ServiceTypeCodes.HeadhuntCod,
            ApplicationStates.Shortlisted,
            [],
            hasSourcingDelivery: false);

        recipients.Should().BeEquivalentTo(new[] { hrId, clientId });
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public void SelectApplicationScoredRecipients_CvSourcing_IncludesClientOnlyWhenDelivered(
        bool hasSourcingDelivery, bool expectClientIncluded)
    {
        var hrId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        var recipients = SignalRNotificationPublisher.SelectApplicationScoredRecipients(
            [hrId],
            [clientId],
            ServiceTypeCodes.CvSourcing,
            ApplicationStates.Shortlisted,
            [ApplicationStates.Shortlisted],
            hasSourcingDelivery);

        if (expectClientIncluded)
            recipients.Should().BeEquivalentTo(new[] { hrId, clientId });
        else
            recipients.Should().BeEquivalentTo(new[] { hrId });
    }

    [Fact]
    public async Task PushScoredAsync_HeadhuntSubmitted_DoesNotPushToCompanyClient()
    {
        await using var db = CreateContext();
        var fixture = await SeedAttemptAsync(db);
        var companyId = Guid.NewGuid();
        var hrId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var headhuntType = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = ServiceTypeCodes.HeadhuntCod, Name = "Headhunt", IsActive = true };
        db.ServiceTypes.Add(headhuntType);
        db.Jobs.Add(new Job { JobId = fixture.JobId, CompanyId = companyId, ServiceTypeId = headhuntType.ServiceTypeId, ServiceType = headhuntType, Title = "Senior Dev", Status = "ACTIVE", CurrencyCode = "VND" });
        var hrRole = new Role { RoleId = Guid.NewGuid(), Code = RoleCodes.InternalHr, Name = "HR", IsActive = true };
        db.Roles.Add(hrRole);
        db.UserRoles.Add(new UserRole { UserId = hrId, RoleId = hrRole.RoleId, Status = UserRoleAssignmentStates.Active, AssignmentSource = "TEST" });
        db.CompanyUsers.Add(new CompanyUser { CompanyUserId = Guid.NewGuid(), CompanyId = companyId, UserId = clientId, Status = UserAccountStates.Active, RoleInCompany = "OWNER" });
        await db.SaveChangesAsync();

        var proxy = new Mock<IClientProxy>();
        var clients = new Mock<IHubClients>();
        IReadOnlyList<string>? targeted = null;
        clients.Setup(c => c.Groups(It.IsAny<IReadOnlyList<string>>()))
            .Callback<IReadOnlyList<string>>(g => targeted = g).Returns(proxy.Object);
        var hub = new Mock<IHubContext<NotificationHub>>();
        hub.SetupGet(h => h.Clients).Returns(clients.Object);

        await AiResultCallbackProcessor.PushScoredAsync(
            CreateCallback(fixture, "COMPLETED", 82m), db, hub.Object, NullLogger.Instance, CancellationToken.None);

        targeted.Should().BeEquivalentTo(new[] { NotificationHub.UserGroup(hrId) });
        proxy.Verify(p => p.SendCoreAsync("application.scored", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PushScoredAsync_WithPublisher_SwallowsErrorsAndCallsPublishApplicationScored()
    {
        var fixture = new AttemptFixture(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var payload = CreateCallback(fixture, "COMPLETED", 85m);
        var publisher = new Mock<INotificationPublisher>();
        publisher.Setup(p => p.PublishApplicationScoredAsync(fixture.ApplicationId, fixture.JobId, "COMPLETED", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Hub unavailable"));

        var act = () => AiResultCallbackProcessor.PushScoredAsync(payload, publisher.Object, NullLogger.Instance, CancellationToken.None);

        await act.Should().NotThrowAsync();
        publisher.Verify(p => p.PublishApplicationScoredAsync(fixture.ApplicationId, fixture.JobId, "COMPLETED", It.IsAny<CancellationToken>()), Times.Once);
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
            NextAttemptAt = DateTime.UtcNow.AddMinutes(5),
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
        using var warnings = JsonDocument.Parse("""["EXPERIENCE_EVIDENCE_UNRESOLVED"]""");
        using var diagnostics = JsonDocument.Parse(
            """[{"code":"EXPERIENCE_EVIDENCE_UNRESOLVED","category":"MISSING_EVIDENCE","field":"experience"}]""");
        using var missing = JsonDocument.Parse("""["Experience could not be verified"]""");
        using var reasons = JsonDocument.Parse("""["Manual review is required"]""");
        using var fingerprints = JsonDocument.Parse(
            """{"cvSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","jdSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}""");
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
            status == "FAILED" ? "Unable to read CV" : null,
            0.55m,
            true,
            warnings.RootElement.Clone(),
            diagnostics.RootElement.Clone(),
            0.42m,
            missing.RootElement.Clone(),
            reasons.RootElement.Clone(),
            fingerprints.RootElement.Clone());
    }

    private sealed record AttemptFixture(Guid ApplicationId, Guid CvId, Guid JobId, Guid RequestId);
}
