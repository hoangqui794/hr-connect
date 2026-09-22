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
    }
}
