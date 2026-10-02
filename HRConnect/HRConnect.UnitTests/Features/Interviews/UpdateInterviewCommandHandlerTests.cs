using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Application.Features.Interviews.Commands.UpdateInterview;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Interviews;

public class UpdateInterviewCommandHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviewRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<UpdateInterviewCommandHandler>> _loggerMock = new();

    private UpdateInterviewCommandHandler CreateHandler() =>
        new(
            _interviewRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenInterviewNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Interview?)null);

        var command = new UpdateInterviewCommand(
            InterviewId: interviewId,
            DurationMinutes: 60,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: null,
            Participants: null,
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
    public async Task Handle_WhenInterviewStatusCompletedOrCancelled_ShouldThrowBadRequestException()
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

        var command = new UpdateInterviewCommand(
            InterviewId: interviewId,
            DurationMinutes: 60,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: null,
            Participants: null,
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

        var command = new UpdateInterviewCommand(
            InterviewId: interviewId,
            DurationMinutes: 60,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: null,
            Participants: null,
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

        var command = new UpdateInterviewCommand(
            InterviewId: interviewId,
            DurationMinutes: 60,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: null,
            Participants: null,
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
    public async Task Handle_WhenUserIsClientCompanyUser_AndSameCompany_ShouldUpdateSuccessfully()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var oldToken = Guid.NewGuid();

        var interview = new Interview
        {
            InterviewId = interviewId,
            Status = "SCHEDULED",
            DurationMinutes = 45,
            InterviewType = "ONLINE",
            ConcurrencyToken = oldToken,
            Application = new HRConnect.Domain.Entities.Application
            {
                Job = new Job { CompanyId = companyId }
            },
            InterviewParticipants = new List<InterviewParticipant>()
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

        var command = new UpdateInterviewCommand(
            InterviewId: interviewId,
            DurationMinutes: 90,
            InterviewType: "OFFLINE",
            Location: "Phòng họp A",
            MeetingLink: null,
            Participants: new List<ScheduleInterviewParticipantDto>
            {
                new(Guid.NewGuid(), "INTERVIEWER")
            },
            ConcurrencyToken: oldToken,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.DurationMinutes.Should().Be(90);
        result.Data.InterviewType.Should().Be("OFFLINE");
        result.Data.Location.Should().Be("Phòng họp A");
        result.Data.ConcurrencyToken.Should().NotBe(oldToken);
        result.Data.Participants.Should().HaveCount(1);

        _interviewRepositoryMock.Verify(r => r.Update(interview), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenDurationMinutesInvalid_ShouldThrowBadRequestException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var interview = new Interview
        {
            InterviewId = interviewId,
            Status = "SCHEDULED"
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var command = new UpdateInterviewCommand(
            InterviewId: interviewId,
            DurationMinutes: 0,
            InterviewType: null,
            Location: null,
            MeetingLink: null,
            Participants: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*từ 1 đến 480 phút*");
    }
}
