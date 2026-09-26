using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Commands.RecordInterviewResult;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Interviews;

public class RecordInterviewResultCommandHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviewRepositoryMock = new();
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<RecordInterviewResultCommandHandler>> _loggerMock = new();

    private RecordInterviewResultCommandHandler CreateHandler() =>
        new(
            _interviewRepositoryMock.Object,
            _applicationRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);

    [Theory]
    [InlineData("")]
    [InlineData("UNKNOWN_RESULT")]
    public async Task Handle_WhenResultIsInvalid_ShouldThrowBadRequestException(string result)
    {
        // Arrange
        var command = new RecordInterviewResultCommand(
            InterviewId: Guid.NewGuid(),
            Result: result,
            Feedback: null,
            IsFinalRound: false,
            NextAction: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Handle_WhenInterviewNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Interview?)null);

        var command = new RecordInterviewResultCommand(
            InterviewId: interviewId,
            Result: "PASSED",
            Feedback: "Great candidate",
            IsFinalRound: true,
            NextAction: "MAKE_OFFER",
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
    public async Task Handle_WhenInterviewCancelled_ShouldThrowBadRequestException()
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

        var command = new RecordInterviewResultCommand(
            InterviewId: interviewId,
            Result: "PASSED",
            Feedback: null,
            IsFinalRound: false,
            NextAction: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*đã bị hủy*");
    }

    [Fact]
    public async Task Handle_WhenInterviewAlreadyCompleted_ShouldThrowBadRequestException()
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

        var command = new RecordInterviewResultCommand(
            InterviewId: interviewId,
            Result: "PASSED",
            Feedback: null,
            IsFinalRound: false,
            NextAction: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*đã được ghi nhận kết quả trước đó*");
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

        var command = new RecordInterviewResultCommand(
            InterviewId: interviewId,
            Result: "PASSED",
            Feedback: null,
            IsFinalRound: false,
            NextAction: null,
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

        var command = new RecordInterviewResultCommand(
            InterviewId: interviewId,
            Result: "PASSED",
            Feedback: null,
            IsFinalRound: false,
            NextAction: null,
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
    public async Task Handle_WhenUserIsClientCompanyUser_AndSameCompany_PassedFinalRound_ShouldCompleteAndSetOfferPending()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var oldToken = Guid.NewGuid();

        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            Status = "INTERVIEWING",
            Job = new Job { CompanyId = companyId }
        };

        var interview = new Interview
        {
            InterviewId = interviewId,
            ApplicationId = application.ApplicationId,
            Status = "SCHEDULED",
            ConcurrencyToken = oldToken,
            Application = application,
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

        var command = new RecordInterviewResultCommand(
            InterviewId: interviewId,
            Result: "PASSED",
            Feedback: "Xuất sắc, tư duy tốt.",
            IsFinalRound: true,
            NextAction: "MAKE_OFFER",
            ConcurrencyToken: oldToken,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Status.Should().Be("COMPLETED");
        result.Data.Result.Should().Be("PASSED");
        result.Data.Feedback.Should().Be("Xuất sắc, tư duy tốt.");
        result.Data.ApplicationStatus.Should().Be("OFFER_PENDING");

        interview.Status.Should().Be("COMPLETED");
        interview.Result.Should().Be("PASSED");
        interview.RecordedBy.Should().Be(userId);
        interview.RecordedAt.Should().NotBeNull();
        interview.InterviewStatusHistories.Should().HaveCount(1);
        var history = interview.InterviewStatusHistories.First();
        history.OldStatus.Should().Be("SCHEDULED");
        history.NewStatus.Should().Be("COMPLETED");

        application.Status.Should().Be("OFFER_PENDING");
        _applicationRepositoryMock.Verify(r => r.Update(application), Times.Once);
        _interviewRepositoryMock.Verify(r => r.Update(interview), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenUserIsInternalHrOrAdmin_FailedFinalRound_ShouldCompleteAndSetRejected()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var adminId = Guid.NewGuid();

        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            Status = "INTERVIEWING",
            Job = new Job { CompanyId = Guid.NewGuid() }
        };

        var interview = new Interview
        {
            InterviewId = interviewId,
            ApplicationId = application.ApplicationId,
            Status = "SCHEDULED",
            Application = application,
            InterviewStatusHistories = new List<InterviewStatusHistory>()
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdForUpdateAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new RecordInterviewResultCommand(
            InterviewId: interviewId,
            Result: "FAILED",
            Feedback: "Không đạt yêu cầu chuyên môn",
            IsFinalRound: true,
            NextAction: "REJECT",
            ConcurrencyToken: null,
            CurrentUserId: adminId,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Status.Should().Be("COMPLETED");
        result.Data.Result.Should().Be("FAILED");
        result.Data.ApplicationStatus.Should().Be("REJECTED");

        application.Status.Should().Be("REJECTED");
        _applicationRepositoryMock.Verify(r => r.Update(application), Times.Once);
    }
}
