using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Infrastructure.Services.Integration;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Integration;

public class Mf03ScoringTriggerTests
{
    [Fact]
    public async Task TriggerScoringAsync_WithValidPayload_AddsPendingOutboxRecord()
    {
        // Arrange
        var loggerMock = new Mock<ILogger<Mf03ScoringTrigger>>();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var context = new ApplicationDbContext(options);
        var trigger = new Mf03ScoringTrigger(context, loggerMock.Object);

        var payload = new Mf03TriggerPayload(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid());

        // Act
        Func<Task> act = async () => await trigger.TriggerScoringAsync(payload, CancellationToken.None);

        // Assert
        await act.Should().NotThrowAsync();
        var queued = context.ChangeTracker.Entries<HRConnect.Domain.Entities.AiMatchResult>()
            .Single().Entity;
        queued.ApplicationId.Should().Be(payload.ApplicationId);
        queued.AttemptNo.Should().Be(1);
        queued.Status.Should().Be("PENDING");
        queued.ExternalReference.Should().NotBeNullOrWhiteSpace();

        var audit = context.ChangeTracker.Entries<HRConnect.Domain.Entities.AuditLog>()
            .Single().Entity;
        audit.ActorUserId.Should().Be(payload.ActorUserId);
        audit.Action.Should().Be("AI_SCORING_REQUESTED");
        audit.EntityType.Should().Be("APPLICATION");
        audit.EntityId.Should().Be(payload.ApplicationId);
        audit.CorrelationId.Should().Be(queued.MatchResultId);
    }

    [Fact]
    public async Task TriggerScoringAsync_WithExistingAttempt_AddsRetryAuditAndNextAttempt()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var context = new ApplicationDbContext(options);
        var applicationId = Guid.NewGuid();
        context.AiMatchResults.Add(new HRConnect.Domain.Entities.AiMatchResult
        {
            MatchResultId = Guid.NewGuid(),
            ApplicationId = applicationId,
            AttemptNo = 1,
            Status = "FAILED",
            RequestedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        var trigger = new Mf03ScoringTrigger(
            context,
            new Mock<ILogger<Mf03ScoringTrigger>>().Object);
        var payload = new Mf03TriggerPayload(
            applicationId,
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid());

        await trigger.TriggerScoringAsync(payload, CancellationToken.None);

        context.ChangeTracker.Entries<HRConnect.Domain.Entities.AiMatchResult>()
            .Single(entry => entry.State == EntityState.Added)
            .Entity.AttemptNo.Should().Be(2);
        context.ChangeTracker.Entries<HRConnect.Domain.Entities.AuditLog>()
            .Single().Entity.Action.Should().Be("AI_SCORING_RETRY_REQUESTED");
    }
}
