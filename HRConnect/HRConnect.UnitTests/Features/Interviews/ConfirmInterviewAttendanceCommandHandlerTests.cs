using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Interviews.Commands.ConfirmInterviewAttendance;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Interviews;

public class ConfirmInterviewAttendanceCommandHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviews = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditLogService> _auditLogs = new();
    private readonly Mock<INotificationRepository> _notifications = new();

    private ConfirmInterviewAttendanceCommandHandler CreateHandler() => new(
        _interviews.Object,
        _unitOfWork.Object,
        _auditLogs.Object,
        _notifications.Object);

    [Fact]
    public async Task Handle_WhenCandidateOwnsUpcomingInterview_ConfirmsWithoutChangingInterviewStatus()
    {
        var candidateUserId = Guid.NewGuid();
        var creatorUserId = Guid.NewGuid();
        var interview = CreateInterview(candidateUserId, creatorUserId, DateTime.UtcNow.AddDays(2));
        Notification? notification = null;

        _interviews.Setup(r => r.GetByIdForUpdateAsync(interview.InterviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);
        _unitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _notifications
            .Setup(r => r.AddAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .Callback<Notification, CancellationToken>((item, _) => notification = item)
            .Returns(Task.CompletedTask);

        var result = await CreateHandler().Handle(
            new ConfirmInterviewAttendanceCommand(interview.InterviewId, candidateUserId),
            CancellationToken.None);

        result.AttendanceStatus.Should().Be(CandidateAttendanceStates.Confirmed);
        result.AlreadyConfirmed.Should().BeFalse();
        interview.Status.Should().Be(InterviewStates.Scheduled);
        interview.CandidateAttendanceStatus.Should().Be(CandidateAttendanceStates.Confirmed);
        interview.CandidateRespondedAt.Should().NotBeNull();
        notification.Should().NotBeNull();
        notification!.UserId.Should().Be(creatorUserId);
        notification.Metadata.Should().Contain($"/client/candidates?open={interview.ApplicationId}");
        _auditLogs.Verify(a => a.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.InterviewAttendanceConfirmed),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAlreadyConfirmed_ReturnsIdempotentlyWithoutDuplicateSideEffects()
    {
        var candidateUserId = Guid.NewGuid();
        var confirmedAt = DateTime.UtcNow.AddHours(-1);
        var interview = CreateInterview(candidateUserId, Guid.NewGuid(), DateTime.UtcNow.AddDays(1));
        interview.CandidateAttendanceStatus = CandidateAttendanceStates.Confirmed;
        interview.CandidateRespondedAt = confirmedAt;
        _interviews.Setup(r => r.GetByIdForUpdateAsync(interview.InterviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var result = await CreateHandler().Handle(
            new ConfirmInterviewAttendanceCommand(interview.InterviewId, candidateUserId),
            CancellationToken.None);

        result.AlreadyConfirmed.Should().BeTrue();
        result.RespondedAt.Should().Be(confirmedAt);
        _notifications.Verify(
            r => r.AddAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _auditLogs.Verify(
            a => a.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenAnotherCandidateAttemptsConfirmation_ThrowsForbidden()
    {
        var interview = CreateInterview(Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow.AddDays(1));
        _interviews.Setup(r => r.GetByIdForUpdateAsync(interview.InterviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var act = () => CreateHandler().Handle(
            new ConfirmInterviewAttendanceCommand(interview.InterviewId, Guid.NewGuid()),
            CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không có quyền xác nhận*");
    }

    [Fact]
    public async Task Handle_WhenInterviewAlreadyStarted_ThrowsBadRequest()
    {
        var candidateUserId = Guid.NewGuid();
        var interview = CreateInterview(candidateUserId, Guid.NewGuid(), DateTime.UtcNow.AddMinutes(-1));
        _interviews.Setup(r => r.GetByIdForUpdateAsync(interview.InterviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var act = () => CreateHandler().Handle(
            new ConfirmInterviewAttendanceCommand(interview.InterviewId, candidateUserId),
            CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*sau khi thời gian phỏng vấn đã bắt đầu*");
    }

    [Theory]
    [InlineData(InterviewStates.Cancelled)]
    [InlineData(InterviewStates.Completed)]
    [InlineData(InterviewStates.NoShow)]
    public async Task Handle_WhenInterviewIsTerminal_ThrowsBadRequest(string status)
    {
        var candidateUserId = Guid.NewGuid();
        var interview = CreateInterview(candidateUserId, Guid.NewGuid(), DateTime.UtcNow.AddDays(1));
        interview.Status = status;
        _interviews.Setup(r => r.GetByIdForUpdateAsync(interview.InterviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var act = () => CreateHandler().Handle(
            new ConfirmInterviewAttendanceCommand(interview.InterviewId, candidateUserId),
            CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*đang chờ diễn ra*");
    }

    private static Interview CreateInterview(Guid candidateUserId, Guid creatorUserId, DateTime scheduledAt)
    {
        var applicationId = Guid.NewGuid();
        return new Interview
        {
            InterviewId = Guid.NewGuid(),
            ApplicationId = applicationId,
            InterviewRound = 2,
            Status = InterviewStates.Scheduled,
            ScheduledAt = scheduledAt,
            CreatedBy = creatorUserId,
            ConcurrencyToken = Guid.NewGuid(),
            Application = new Domain.Entities.Application
            {
                ApplicationId = applicationId,
                Candidate = new Candidate
                {
                    UserId = candidateUserId,
                    FullName = "Nguyễn Văn A"
                },
                Job = new Job { Title = "Backend Engineer" }
            }
        };
    }
}
