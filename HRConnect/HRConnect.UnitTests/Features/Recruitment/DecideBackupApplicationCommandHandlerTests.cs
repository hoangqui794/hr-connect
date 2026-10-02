using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Commands.DecideBackupApplication;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class DecideBackupApplicationCommandHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<DecideBackupApplicationCommandHandler>> _loggerMock = new();

    private DecideBackupApplicationCommandHandler CreateHandler() =>
        new(
            _applicationRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("UNKNOWN_DECISION")]
    public async Task Handle_WhenDecisionIsInvalid_ShouldThrowBadRequestException(string decision)
    {
        // Arrange
        var command = new DecideBackupApplicationCommand(
            ApplicationId: Guid.NewGuid(),
            Decision: decision,
            Reason: null,
            Note: null,
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
    public async Task Handle_WhenApplicationNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Domain.Entities.Application?)null);

        var command = new DecideBackupApplicationCommand(
            ApplicationId: appId,
            Decision: "SELECT",
            Reason: "Candidate selected",
            Note: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy hồ sơ ứng tuyển*");
    }

    [Fact]
    public async Task Handle_WhenClientUserHasNoCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "BACKUP",
            Job = new Job { JobId = Guid.NewGuid(), CompanyId = Guid.NewGuid() }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var command = new DecideBackupApplicationCommand(
            ApplicationId: appId,
            Decision: "SELECT",
            Reason: null,
            Note: null,
            ConcurrencyToken: null,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Tài khoản không thuộc doanh nghiệp nào*");
    }

    [Fact]
    public async Task Handle_WhenClientUserBelongsToDifferentCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var jobCompanyId = Guid.NewGuid();
        var userCompanyId = Guid.NewGuid();

        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "BACKUP",
            Job = new Job { JobId = Guid.NewGuid(), CompanyId = jobCompanyId }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = userCompanyId });

        var command = new DecideBackupApplicationCommand(
            ApplicationId: appId,
            Decision: "SELECT",
            Reason: null,
            Note: null,
            ConcurrencyToken: null,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Bạn không có quyền quyết định hồ sơ dự phòng cho doanh nghiệp khác*");
    }

    [Fact]
    public async Task Handle_WhenUserHasNoPermission_ShouldThrowForbiddenException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "BACKUP",
            Job = new Job { JobId = Guid.NewGuid(), CompanyId = Guid.NewGuid() }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new DecideBackupApplicationCommand(
            ApplicationId: appId,
            Decision: "SELECT",
            Reason: null,
            Note: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Bạn không có quyền quyết định ứng viên dự phòng*");
    }

    [Fact]
    public async Task Handle_WhenApplicationIsNotBackup_ShouldThrowBadRequestException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "REJECTED",
            Interviews = new List<Interview>()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new DecideBackupApplicationCommand(
            ApplicationId: appId,
            Decision: "SELECT",
            Reason: null,
            Note: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*không phải là hồ sơ dự phòng*");
    }

    [Fact]
    public async Task Handle_WhenConcurrencyTokenMismatched_ShouldThrowConflictException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var currentToken = Guid.NewGuid();
        var clientToken = Guid.NewGuid();

        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "BACKUP",
            ConcurrencyToken = currentToken
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new DecideBackupApplicationCommand(
            ApplicationId: appId,
            Decision: "SELECT",
            Reason: null,
            Note: null,
            ConcurrencyToken: clientToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Dữ liệu hồ sơ ứng tuyển đã bị thay đổi*");
    }

    [Fact]
    public async Task Handle_WhenDecisionIsSelect_ShouldUpdateStatusToInterviewAndRecordHistory()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var initialToken = Guid.NewGuid();

        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "BACKUP",
            ConcurrencyToken = initialToken,
            ApplicationStatusHistories = new List<ApplicationStatusHistory>()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new DecideBackupApplicationCommand(
            ApplicationId: appId,
            Decision: "SELECT",
            Reason: "Ứng viên chính đã từ chối offer, chọn dự phòng.",
            Note: "Kích hoạt phỏng vấn tiếp theo.",
            ConcurrencyToken: initialToken,
            CurrentUserId: userId,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.ApplicationId.Should().Be(appId);
        result.Data.PreviousStatus.Should().Be("BACKUP");
        result.Data.CurrentStatus.Should().Be("INTERVIEW");
        result.Data.Decision.Should().Be("SELECT");
        result.Data.DecidedBy.Should().Be(userId);
        result.Data.ConcurrencyToken.Should().NotBe(initialToken);

        application.Status.Should().Be("INTERVIEW");
        application.ConcurrencyToken.Should().Be(result.Data.ConcurrencyToken);
        application.ApplicationStatusHistories.Should().HaveCount(1);
        var history = application.ApplicationStatusHistories.First();
        history.OldStatus.Should().Be("BACKUP");
        history.NewStatus.Should().Be("INTERVIEW");
        history.ChangedBy.Should().Be(userId);

        _applicationRepositoryMock.Verify(r => r.Update(application), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenDecisionIsReject_ShouldUpdateStatusToBackupNotSelected()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "BACKUP",
            ApplicationStatusHistories = new List<ApplicationStatusHistory>()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new DecideBackupApplicationCommand(
            ApplicationId: appId,
            Decision: "REJECT",
            Reason: "Không đáp ứng yêu cầu vòng phỏng vấn phụ.",
            Note: null,
            ConcurrencyToken: null,
            CurrentUserId: userId,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Data!.CurrentStatus.Should().Be("BACKUP_NOT_SELECTED");
        result.Data.Decision.Should().Be("REJECT");
        application.Status.Should().Be("BACKUP_NOT_SELECTED");

        _applicationRepositoryMock.Verify(r => r.Update(application), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenDecisionIsKeepOnHold_ShouldRetainBackupStatus()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "BACKUP",
            ApplicationStatusHistories = new List<ApplicationStatusHistory>()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new DecideBackupApplicationCommand(
            ApplicationId: appId,
            Decision: "KEEP_ON_HOLD",
            Reason: "Chờ kết quả phản hồi của ứng viên chính đợt 1.",
            Note: null,
            ConcurrencyToken: null,
            CurrentUserId: userId,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Data!.CurrentStatus.Should().Be("BACKUP");
        result.Data.Decision.Should().Be("KEEP_ON_HOLD");
        application.Status.Should().Be("BACKUP");

        _applicationRepositoryMock.Verify(r => r.Update(application), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
