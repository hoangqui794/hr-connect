using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.InternalHr.Commands.RetryAiScoring;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.InternalHr;

public sealed class RetryAiScoringCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithLatestFailedAttempt_QueuesAnotherAttempt()
    {
        var application = CreateApplication("FAILED");
        var applications = new Mock<IApplicationRepository>();
        applications.Setup(repository => repository.GetByIdWithDetailsAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        var trigger = new Mock<IMf03ScoringTrigger>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var handler = CreateHandler(applications.Object, trigger.Object, unitOfWork.Object);
        var requestedBy = Guid.NewGuid();

        var response = await handler.Handle(new RetryAiScoringCommand(application.ApplicationId, requestedBy), CancellationToken.None);

        response.Success.Should().BeTrue();
        response.AiStatus.Should().Be("PENDING");
        trigger.Verify(item => item.TriggerScoringAsync(
            It.Is<Mf03TriggerPayload>(payload =>
                payload.ApplicationId == application.ApplicationId &&
                payload.CvId == application.Submission!.CvId &&
                payload.JobId == application.JobId &&
                payload.ActorUserId == requestedBy),
            It.IsAny<CancellationToken>()), Times.Once);
        unitOfWork.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("PENDING")]
    [InlineData("PROCESSING")]
    [InlineData("COMPLETED")]
    public async Task Handle_WithNonFailedLatestAttempt_RejectsRetry(string status)
    {
        var application = CreateApplication(status);
        var applications = new Mock<IApplicationRepository>();
        applications.Setup(repository => repository.GetByIdWithDetailsAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        var trigger = new Mock<IMf03ScoringTrigger>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var handler = CreateHandler(applications.Object, trigger.Object, unitOfWork.Object);

        var action = () => handler.Handle(new RetryAiScoringCommand(application.ApplicationId, Guid.NewGuid()), CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>();
        trigger.Verify(item => item.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
        unitOfWork.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    private static RetryAiScoringCommandHandler CreateHandler(
        IApplicationRepository applications,
        IMf03ScoringTrigger trigger,
        IUnitOfWork unitOfWork) =>
        new(applications, trigger, unitOfWork, Mock.Of<ILogger<RetryAiScoringCommandHandler>>());

    private static JobApplication CreateApplication(string status)
    {
        var submission = new Submission { SubmissionId = Guid.NewGuid(), CvId = Guid.NewGuid() };
        return new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            JobId = Guid.NewGuid(),
            Submission = submission,
            AiMatchResults = new List<AiMatchResult>
            {
                new() { MatchResultId = Guid.NewGuid(), AttemptNo = 1, Status = status }
            }
        };
    }
}
