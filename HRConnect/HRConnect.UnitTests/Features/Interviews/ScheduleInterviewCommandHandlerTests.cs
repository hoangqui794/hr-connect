using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Interviews;

public class ScheduleInterviewCommandHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviewRepositoryMock = new();
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<ScheduleInterviewCommandHandler>> _loggerMock = new();

    private ScheduleInterviewCommandHandler CreateHandler() =>
        new(
            _interviewRepositoryMock.Object,
            _applicationRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenScheduledAtInPast_ShouldThrowBadRequestException()
    {
        // Arrange
        var command = new ScheduleInterviewCommand(
            ApplicationId: Guid.NewGuid(),
            ScheduledAt: DateTime.UtcNow.AddHours(-1),
            DurationMinutes: 60,
            InterviewRound: 1,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: "https://meet.google.com/xyz",
            Participants: null,
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
    public async Task Handle_WhenDurationMinutesInvalid_ShouldThrowBadRequestException()
    {
        // Arrange
        var command = new ScheduleInterviewCommand(
            ApplicationId: Guid.NewGuid(),
            ScheduledAt: DateTime.UtcNow.AddDays(1),
            DurationMinutes: 500, // exceeds 480
            InterviewRound: 1,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: "https://meet.google.com/xyz",
            Participants: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*480 phút*");
    }

    [Fact]
    public async Task Handle_WhenApplicationNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var applicationId = Guid.NewGuid();
        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(applicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((HRConnect.Domain.Entities.Application?)null);

        var command = new ScheduleInterviewCommand(
            ApplicationId: applicationId,
            ScheduledAt: DateTime.UtcNow.AddDays(1),
            DurationMinutes: 60,
            InterviewRound: 1,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: null,
            Participants: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy hồ sơ*");
    }

    [Fact]
    public async Task Handle_WhenApplicationStatusRejected_ShouldThrowBadRequestException()
    {
        // Arrange
        var applicationId = Guid.NewGuid();
        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = applicationId,
            Status = "REJECTED"
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(applicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new ScheduleInterviewCommand(
            ApplicationId: applicationId,
            ScheduledAt: DateTime.UtcNow.AddDays(1),
            DurationMinutes: 60,
            InterviewRound: 1,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: null,
            Participants: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*REJECTED*");
    }

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_AndDifferentCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var applicationId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var userCompanyId = Guid.NewGuid();
        var jobCompanyId = Guid.NewGuid();

        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = applicationId,
            Status = "SHORTLISTED",
            Job = new Job { CompanyId = jobCompanyId }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(applicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = userCompanyId });

        var command = new ScheduleInterviewCommand(
            ApplicationId: applicationId,
            ScheduledAt: DateTime.UtcNow.AddDays(1),
            DurationMinutes: 60,
            InterviewRound: 1,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: null,
            Participants: null,
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
    public async Task Handle_WhenUserIsClientCompanyUser_AndSameCompany_ShouldScheduleSuccessfullyAndUpdateStatus()
    {
        // Arrange
        var applicationId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = applicationId,
            Status = "SHORTLISTED",
            Job = new Job { CompanyId = companyId },
            Interviews = new List<Interview>()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(applicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });

        Interview? addedInterview = null;
        _interviewRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Interview>(), It.IsAny<CancellationToken>()))
            .Callback<Interview, CancellationToken>((i, _) => addedInterview = i)
            .Returns(Task.CompletedTask);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new ScheduleInterviewCommand(
            ApplicationId: applicationId,
            ScheduledAt: DateTime.UtcNow.AddDays(2),
            DurationMinutes: 45,
            InterviewRound: null,
            InterviewType: "ONLINE",
            Location: null,
            MeetingLink: "https://meet.google.com/abc-xyz",
            Participants: new List<ScheduleInterviewParticipantDto>
            {
                new(Guid.NewGuid(), "TECHNICAL_LEAD")
            },
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Status.Should().Be("SCHEDULED");
        result.Data.InterviewRound.Should().Be(1);
        result.Data.DurationMinutes.Should().Be(45);
        result.Data.Participants.Should().HaveCount(1);

        application.Status.Should().Be("INTERVIEWING");
        _applicationRepositoryMock.Verify(r => r.Update(application), Times.Once);
        _interviewRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Interview>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

        addedInterview.Should().NotBeNull();
        addedInterview!.InterviewStatusHistories.Should().HaveCount(1);
        addedInterview.InterviewParticipants.Should().HaveCount(1);
    }

    [Fact]
    public async Task Handle_WhenUserIsInternalHrOrAdmin_ShouldScheduleSuccessfully()
    {
        // Arrange
        var applicationId = Guid.NewGuid();
        var adminId = Guid.NewGuid();

        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = applicationId,
            Status = "INTERVIEWING",
            Job = new Job { CompanyId = Guid.NewGuid() },
            Interviews = new List<Interview> { new() { InterviewId = Guid.NewGuid() } }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(applicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new ScheduleInterviewCommand(
            ApplicationId: applicationId,
            ScheduledAt: DateTime.UtcNow.AddDays(3),
            DurationMinutes: 60,
            InterviewRound: null,
            InterviewType: "OFFLINE",
            Location: "Tầng 5, Tòa nhà Bitexco",
            MeetingLink: null,
            Participants: null,
            CurrentUserId: adminId,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.InterviewRound.Should().Be(2); // Auto incremented from 1 existing
        result.Data.InterviewType.Should().Be("OFFLINE");
    }
}
