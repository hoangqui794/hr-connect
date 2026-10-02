using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Commands.CancelInterview;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Interviews;

public class CancelInterviewCommandHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviewRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<CancelInterviewCommandHandler>> _loggerMock = new();

    private CancelInterviewCommandHandler CreateHandler() =>
        new(
            _interviewRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenReasonIsEmpty_ShouldThrowBadRequestException()
    {
        // Arrange
        var command = new CancelInterviewCommand(
            InterviewId: Guid.NewGuid(),
            Reason: "   ",
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Lý do hủy lịch phỏng vấn là bắt buộc*");
    }

    [Fact]
    public async Task Handle_WhenInterviewNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Interview?)null);

        var command = new CancelInterviewCommand(
            InterviewId: interviewId,
            Reason: "Ứng viên từ chối phỏng vấn",
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
    public async Task Handle_WhenInterviewAlreadyCancelled_ShouldThrowBadRequestException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var interview = new Interview
        {
            InterviewId = interviewId,
            Status = "CANCELLED"
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var command = new CancelInterviewCommand(
            InterviewId: interviewId,
            Reason: "Hủy tiếp",
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*đã bị hủy trước đó*");
    }

    [Fact]
    public async Task Handle_WhenInterviewCompleted_ShouldThrowBadRequestException()
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

        var command = new CancelInterviewCommand(
            InterviewId: interviewId,
            Reason: "Hủy phỏng vấn đã hoàn thành",
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*đã hoàn thành*");
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

        var command = new CancelInterviewCommand(
            InterviewId: interviewId,
            Reason: "Hủy phỏng vấn",
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

        var command = new CancelInterviewCommand(
            InterviewId: interviewId,
            Reason: "Hủy phỏng vấn",
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
    public async Task Handle_WhenUserIsClientCompanyUser_AndSameCompany_ShouldCancelSuccessfullyAndRecordHistory()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var scheduledAt = DateTime.UtcNow.AddDays(2);
        var oldToken = Guid.NewGuid();

        var interview = new Interview
        {
            InterviewId = interviewId,
            ScheduledAt = scheduledAt,
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

        var command = new CancelInterviewCommand(
            InterviewId: interviewId,
            Reason: "Ứng viên đã tìm được việc khác",
            ConcurrencyToken: oldToken,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Status.Should().Be("CANCELLED");
        result.Data.Reason.Should().Be("Ứng viên đã tìm được việc khác");
        result.Data.ConcurrencyToken.Should().NotBe(oldToken);

        interview.Status.Should().Be("CANCELLED");
        interview.InterviewStatusHistories.Should().HaveCount(1);
        var history = interview.InterviewStatusHistories.First();
        history.OldStatus.Should().Be("SCHEDULED");
        history.NewStatus.Should().Be("CANCELLED");
        history.OldScheduledAt.Should().Be(scheduledAt);
        history.NewScheduledAt.Should().BeNull();
        history.Reason.Should().Be("Ứng viên đã tìm được việc khác");

        _interviewRepositoryMock.Verify(r => r.Update(interview), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
