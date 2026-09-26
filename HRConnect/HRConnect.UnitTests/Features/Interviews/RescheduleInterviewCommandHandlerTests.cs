using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Commands.RescheduleInterview;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Interviews;

public class RescheduleInterviewCommandHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviewRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<RescheduleInterviewCommandHandler>> _loggerMock = new();

    private RescheduleInterviewCommandHandler CreateHandler() =>
        new(
            _interviewRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenNewScheduledAtInPast_ShouldThrowBadRequestException()
    {
        // Arrange
        var command = new RescheduleInterviewCommand(
            InterviewId: Guid.NewGuid(),
            NewScheduledAt: DateTime.UtcNow.AddHours(-2),
            Reason: "Dời lịch do bận việc",
            DurationMinutes: null,
            Location: null,
            MeetingLink: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*ở tương lai*");
    }

    [Fact]
    public async Task Handle_WhenReasonIsEmpty_ShouldThrowBadRequestException()
    {
        // Arrange
        var command = new RescheduleInterviewCommand(
            InterviewId: Guid.NewGuid(),
            NewScheduledAt: DateTime.UtcNow.AddDays(2),
            Reason: "",
            DurationMinutes: null,
            Location: null,
            MeetingLink: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Lý do dời lịch phỏng vấn là bắt buộc*");
    }

    [Fact]
    public async Task Handle_WhenInterviewNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Interview?)null);

        var command = new RescheduleInterviewCommand(
            InterviewId: interviewId,
            NewScheduledAt: DateTime.UtcNow.AddDays(2),
            Reason: "Thay đổi lịch",
            DurationMinutes: null,
            Location: null,
            MeetingLink: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy lịch phỏng vấn*");
    }

    [Fact]
    public async Task Handle_WhenInterviewStatusCompleted_ShouldThrowBadRequestException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var interview = new Interview
        {
            InterviewId = interviewId,
            Status = "COMPLETED"
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var command = new RescheduleInterviewCommand(
            InterviewId: interviewId,
            NewScheduledAt: DateTime.UtcNow.AddDays(2),
            Reason: "Dời lịch sau khi hoàn tất",
            DurationMinutes: null,
            Location: null,
            MeetingLink: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*COMPLETED*");
    }

    [Fact]
    public async Task Handle_WhenConcurrencyTokenMismatch_ShouldThrowConflictException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var currentToken = Guid.NewGuid();
        var sentToken = Guid.NewGuid();

        var interview = new Interview
        {
            InterviewId = interviewId,
            Status = "SCHEDULED",
            ConcurrencyToken = currentToken
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var command = new RescheduleInterviewCommand(
            InterviewId: interviewId,
            NewScheduledAt: DateTime.UtcNow.AddDays(2),
            Reason: "Dời lịch do bận việc",
            DurationMinutes: null,
            Location: null,
            MeetingLink: null,
            ConcurrencyToken: sentToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Dữ liệu phỏng vấn đã bị thay đổi*");
    }

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_AndDifferentCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var userCompanyId = Guid.NewGuid();
        var jobCompanyId = Guid.NewGuid();

        var interview = new Interview
        {
            InterviewId = interviewId,
            Status = "SCHEDULED",
            Application = new HRConnect.Domain.Entities.Application
            {
                Job = new Job { CompanyId = jobCompanyId }
            }
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = userCompanyId });

        var command = new RescheduleInterviewCommand(
            InterviewId: interviewId,
            NewScheduledAt: DateTime.UtcNow.AddDays(2),
            Reason: "Dời lịch",
            DurationMinutes: null,
            Location: null,
            MeetingLink: null,
            ConcurrencyToken: null,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*doanh nghiệp khác*");
    }

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_AndSameCompany_ShouldRescheduleSuccessfullyAndRecordHistory()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var oldDate = DateTime.UtcNow.AddDays(1);
        var newDate = DateTime.UtcNow.AddDays(3);
        var oldToken = Guid.NewGuid();

        var interview = new Interview
        {
            InterviewId = interviewId,
            ScheduledAt = oldDate,
            Status = "SCHEDULED",
            ConcurrencyToken = oldToken,
            Application = new HRConnect.Domain.Entities.Application
            {
                Job = new Job { CompanyId = companyId }
            },
            InterviewStatusHistories = new List<InterviewStatusHistory>()
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new RescheduleInterviewCommand(
            InterviewId: interviewId,
            NewScheduledAt: newDate,
            Reason: "Phía công ty bận họp đột xuất",
            DurationMinutes: 60,
            Location: null,
            MeetingLink: "https://meet.google.com/new-link",
            ConcurrencyToken: oldToken,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Status.Should().Be("RESCHEDULED");
        result.Data.OldScheduledAt.Should().Be(oldDate);
        result.Data.NewScheduledAt.Should().Be(newDate);
        result.Data.Reason.Should().Be("Phía công ty bận họp đột xuất");
        result.Data.ConcurrencyToken.Should().NotBe(oldToken);

        interview.Status.Should().Be("RESCHEDULED");
        interview.ScheduledAt.Should().Be(newDate);
        interview.InterviewStatusHistories.Should().HaveCount(1);
        var history = interview.InterviewStatusHistories.First();
        history.OldStatus.Should().Be("SCHEDULED");
        history.NewStatus.Should().Be("RESCHEDULED");
        history.OldScheduledAt.Should().Be(oldDate);
        history.NewScheduledAt.Should().Be(newDate);
        history.Reason.Should().Be("Phía công ty bận họp đột xuất");

        _interviewRepositoryMock.Verify(r => r.Update(interview), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
