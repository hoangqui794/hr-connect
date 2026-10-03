using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Services.Audit;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Audit;

public class Mf04AuditLoggingPayloadTests
{
    private static readonly string[] ForbiddenAuditFragments =
    [
        "concurrencytoken", "meetinglink", "offerdocumenturl", "password", "token", "cvcontent"
    ];

    [Fact]
    public void Mf04AuditActions_ContainsAllRequiredLifecycleEvents()
    {
        // Assert all MF-04 canonical actions are registered
        AuditActions.InterviewScheduled.Should().Be("INTERVIEW_SCHEDULED");
        AuditActions.InterviewUpdated.Should().Be("INTERVIEW_UPDATED");
        AuditActions.InterviewRescheduled.Should().Be("INTERVIEW_RESCHEDULED");
        AuditActions.InterviewCancelled.Should().Be("INTERVIEW_CANCELLED");
        AuditActions.InterviewNoShowRecorded.Should().Be("INTERVIEW_NO_SHOW_RECORDED");
        AuditActions.InterviewResultRecorded.Should().Be("INTERVIEW_RESULT_RECORDED");

        AuditActions.OfferDraftCreated.Should().Be("OFFER_DRAFT_CREATED");
        AuditActions.OfferUpdated.Should().Be("OFFER_UPDATED");
        AuditActions.OfferSent.Should().Be("OFFER_SENT");
        AuditActions.OfferAccepted.Should().Be("OFFER_ACCEPTED");
        AuditActions.OfferDeclined.Should().Be("OFFER_DECLINED");
        AuditActions.OfferWithdrawn.Should().Be("OFFER_WITHDRAWN");

        AuditActions.ApplicationStatusChanged.Should().Be("APPLICATION_STATUS_CHANGED");
        AuditActions.ApplicationBackupDecided.Should().Be("APPLICATION_BACKUP_DECIDED");
        AuditActions.ApplicationWithdrawn.Should().Be("APPLICATION_WITHDRAWN");
        AuditActions.ApplicationPlannedStartDateUpdated.Should().Be("APPLICATION_PLANNED_START_DATE_UPDATED");
        AuditActions.ApplicationNotStarted.Should().Be("APPLICATION_NOT_STARTED");
        AuditActions.PlacementConfirmed.Should().Be("PLACEMENT_CONFIRMED");
    }

    [Fact]
    public void Mf04AuditPayloads_DoNotContainForbiddenSensitiveProperties()
    {
        // Arrange sample payload reflecting MF04 business metadata
        var interviewPayload = new
        {
            applicationId = Guid.NewGuid(),
            interviewRound = 1,
            interviewType = "ONLINE",
            status = "SCHEDULED",
            scheduledAt = DateTime.UtcNow
        };

        var offerPayload = new
        {
            applicationId = Guid.NewGuid(),
            offerVersion = 1,
            salary = 20000000m,
            status = "SENT",
            sentAt = DateTime.UtcNow
        };

        var placementPayload = new
        {
            applicationId = Guid.NewGuid(),
            offerId = Guid.NewGuid(),
            actualStartDate = DateTime.UtcNow.Date,
            status = "STARTED",
            position = "Senior .NET Engineer",
            department = "Engineering"
        };

        // Act & Assert
        foreach (var payload in new object[] { interviewPayload, offerPayload, placementPayload })
        {
            var json = JsonSerializer.Serialize(payload);
            foreach (var forbidden in ForbiddenAuditFragments)
            {
                json.ToLowerInvariant().Should().NotContain(forbidden, $"payload must not expose sensitive property {forbidden}");
            }
        }
    }

    [Fact]
    public async Task AuditLogService_RedactsSensitiveFields_AndAppendsToDbContext()
    {
        // Arrange
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new ApplicationDbContext(dbOptions);

        var correlationId = Guid.NewGuid();
        var requestContextMock = new Mock<IRequestContext>();
        requestContextMock.Setup(r => r.UserId).Returns(Guid.NewGuid());
        requestContextMock.Setup(r => r.CorrelationId).Returns(correlationId);
        requestContextMock.Setup(r => r.IpAddress).Returns(System.Net.IPAddress.Loopback);
        requestContextMock.Setup(r => r.UserAgent).Returns("TestAgent");

        var auditService = new AuditLogService(dbContext, requestContextMock.Object);

        var entry = new AuditEntry
        {
            Action = AuditActions.InterviewScheduled,
            EntityType = "INTERVIEW",
            EntityId = Guid.NewGuid(),
            ActorUserId = requestContextMock.Object.UserId,
            OldValues = null,
            NewValues = new
            {
                interviewRound = 1,
                status = "SCHEDULED",
                password = "secret_password", // Should be redacted
                token = "secret_token"        // Should be redacted
            }
        };

        // Act - AddAsync adds to DbContext change tracker without calling SaveChangesAsync
        await auditService.AddAsync(entry, CancellationToken.None);

        // Verify it is in Added state before SaveChangesAsync
        dbContext.ChangeTracker.HasChanges().Should().BeTrue();
        dbContext.AuditLogs.Local.Count.Should().Be(1);

        // Commit to in-memory DB
        await dbContext.SaveChangesAsync();

        // Assert
        var savedLog = await dbContext.AuditLogs.FirstAsync();
        savedLog.Action.Should().Be(AuditActions.InterviewScheduled);
        savedLog.EntityType.Should().Be("INTERVIEW");
        savedLog.CorrelationId.Should().Be(correlationId);
        savedLog.NewValues.Should().Contain("[REDACTED]");
        savedLog.NewValues.Should().NotContain("secret_password");
        savedLog.NewValues.Should().NotContain("secret_token");
    }

    [Fact]
    public async Task AuditLogService_RejectsPayloadExceedingMaxLimit()
    {
        // Arrange
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new ApplicationDbContext(dbOptions);
        var requestContextMock = new Mock<IRequestContext>();
        var auditService = new AuditLogService(dbContext, requestContextMock.Object);

        var massiveData = new string('A', 20_000);
        var entry = new AuditEntry
        {
            Action = AuditActions.InterviewResultRecorded,
            EntityType = "INTERVIEW",
            EntityId = Guid.NewGuid(),
            NewValues = new { bigData = massiveData }
        };

        // Act & Assert
        var act = () => auditService.AddAsync(entry, CancellationToken.None);
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*must not exceed 16384 characters*");
    }
}
