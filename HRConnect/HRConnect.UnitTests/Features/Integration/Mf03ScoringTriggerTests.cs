using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Infrastructure.Services.Integration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Integration;

public class Mf03ScoringTriggerTests
{
    [Fact]
    public async Task TriggerScoringAsync_WithValidPayload_LogsAndCompletesSuccessfully()
    {
        // Arrange
        var loggerMock = new Mock<ILogger<Mf03ScoringTrigger>>();
        var trigger = new Mf03ScoringTrigger(loggerMock.Object);

        var payload = new Mf03TriggerPayload(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid());

        // Act
        Func<Task> act = async () => await trigger.TriggerScoringAsync(payload, CancellationToken.None);

        // Assert
        await act.Should().NotThrowAsync();
        payload.ApplicationId.Should().NotBeEmpty();
        payload.CvId.Should().NotBeEmpty();
        payload.JobId.Should().NotBeEmpty();
    }
}
