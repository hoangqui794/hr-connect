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
        response.Reason.Should().Be(Mf03ScoringReasons.FailedRetry);
        trigger.Verify(item => item.TriggerScoringAsync(
            It.Is<Mf03TriggerPayload>(payload =>
                payload.ApplicationId == application.ApplicationId &&
                payload.CvId == application.Submission!.CvId &&
                payload.JobId == application.JobId &&
                payload.ActorUserId == requestedBy &&
                payload.Reason == Mf03ScoringReasons.FailedRetry),
            It.IsAny<CancellationToken>()), Times.Once);
        unitOfWork.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("PENDING")]
    [InlineData("PROCESSING")]
    public async Task Handle_WithInFlightLatestAttempt_RejectsRetry(string status)
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

    [Theory]
    [InlineData("COMPLETED", Mf03ScoringReasons.JdUpdated)]
    [InlineData("COMPLETED", Mf03ScoringReasons.ManualReview)]
    [InlineData("FAILED", Mf03ScoringReasons.JdUpdated)]
    [InlineData("FAILED", Mf03ScoringReasons.ManualReview)]
    public async Task Handle_WithTerminalAttemptAndRescoreReason_QueuesAnotherAttempt(
        string status,
        string reason)
    {
        var application = CreateApplication(status);
        var applications = new Mock<IApplicationRepository>();
        applications.Setup(repository => repository.GetByIdWithDetailsAsync(
                application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        var trigger = new Mock<IMf03ScoringTrigger>();
        var handler = CreateHandler(applications.Object, trigger.Object, Mock.Of<IUnitOfWork>());

        var response = await handler.Handle(new RetryAiScoringCommand(
            application.ApplicationId, Guid.NewGuid(), reason), CancellationToken.None);

        response.Reason.Should().Be(reason);
        trigger.Verify(item => item.TriggerScoringAsync(
            It.Is<Mf03TriggerPayload>(payload => payload.Reason == reason),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("COMPLETED", Mf03ScoringReasons.FailedRetry)]
    [InlineData("FAILED", "UNSUPPORTED")]
    public async Task Handle_WithInvalidReasonForLatestState_RejectsRequest(
        string status,
        string reason)
    {
        var application = CreateApplication(status);
        var applications = new Mock<IApplicationRepository>();
        applications.Setup(repository => repository.GetByIdWithDetailsAsync(
                application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        var trigger = new Mock<IMf03ScoringTrigger>();
        var handler = CreateHandler(applications.Object, trigger.Object, Mock.Of<IUnitOfWork>());

        var action = () => handler.Handle(new RetryAiScoringCommand(
            application.ApplicationId, Guid.NewGuid(), reason), CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>();
        trigger.Verify(item => item.TriggerScoringAsync(
            It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
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
