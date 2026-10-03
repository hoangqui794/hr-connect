using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Commands.MarkNotStarted;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class MarkNotStartedCommandHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<IPlacementRepository> _placementRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<MarkNotStartedCommandHandler>> _loggerMock = new();

    private MarkNotStartedCommandHandler CreateHandler() =>
        new(
            _applicationRepositoryMock.Object,
            _placementRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null!)]
    public async Task Handle_WhenReasonIsEmptyOrWhitespace_ShouldThrowBadRequestException(string? reason)
    {
        // Arrange
        var command = new MarkNotStartedCommand(
            ApplicationId: Guid.NewGuid(),
            Reason: reason!,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*bắt buộc*");
    }

    [Fact]
    public async Task Handle_WhenApplicationNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Domain.Entities.Application?)null);

        var command = new MarkNotStartedCommand(
            ApplicationId: appId,
            Reason: "Ứng viên không đến ngày đầu",
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WhenConcurrencyTokenMismatch_ShouldThrowConflictException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new MarkNotStartedCommand(
            ApplicationId: appId,
            Reason: "Ứng viên không đến ngày đầu",
            ConcurrencyToken: Guid.NewGuid(),
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Handle_WhenClientUserNotBelongingToAnyCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var command = new MarkNotStartedCommand(
            ApplicationId: appId,
            Reason: "Ứng viên không đến ngày đầu",
            ConcurrencyToken: application.ConcurrencyToken,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không thuộc doanh nghiệp*");
    }

    [Fact]
    public async Task Handle_WhenClientUserOfDifferentCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var jobCompanyId = Guid.NewGuid();
        var userCompanyId = Guid.NewGuid();

        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = Guid.NewGuid(),
            Job = new Job { CompanyId = jobCompanyId }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = userCompanyId });

        var command = new MarkNotStartedCommand(
            ApplicationId: appId,
            Reason: "Ứng viên không đến",
            ConcurrencyToken: application.ConcurrencyToken,
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
    public async Task Handle_WhenApplicationAlreadyNotStarted_ShouldThrowBadRequestException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "NOT_STARTED",
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new MarkNotStartedCommand(
            ApplicationId: appId,
            Reason: "Ứng viên hủy nhận việc",
            ConcurrencyToken: application.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*NOT_STARTED*");
    }

    [Theory]
    [InlineData("REJECTED")]
    [InlineData("WITHDRAWN")]
    [InlineData("INTERVIEW_FAILED")]
    [InlineData("BACKUP_NOT_SELECTED")]
    [InlineData("CLOSED")]
    public async Task Handle_WhenApplicationIsInTerminalStatus_ShouldThrowBadRequestException(string terminalStatus)
    {
        // Arrange
        var appId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = terminalStatus,
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new MarkNotStartedCommand(
            ApplicationId: appId,
            Reason: "Ứng viên hủy nhận việc",
            ConcurrencyToken: application.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage($"*{terminalStatus}*");
    }

    [Fact]
    public async Task Handle_WhenValidWithoutExistingPlacement_ShouldUpdateApplicationToNotStarted()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var initialToken = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = initialToken,
            Job = new Job { CompanyId = companyId }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });

        _placementRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Placement?)null);

        var command = new MarkNotStartedCommand(
            ApplicationId: appId,
            Reason: "Ứng viên báo bận việc gia đình không thể nhận việc",
            ConcurrencyToken: initialToken,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.ApplicationId.Should().Be(appId);
        result.Status.Should().Be("NOT_STARTED");
        result.Reason.Should().Be("Ứng viên báo bận việc gia đình không thể nhận việc");
        result.ConcurrencyToken.Should().NotBe(initialToken);

        application.Status.Should().Be("NOT_STARTED");
        application.StatusReason.Should().Be("Ứng viên báo bận việc gia đình không thể nhận việc");
        application.ApplicationStatusHistories.Should().HaveCount(1);
        application.ApplicationStatusHistories.First().OldStatus.Should().Be("OFFER_ACCEPTED");
        application.ApplicationStatusHistories.First().NewStatus.Should().Be("NOT_STARTED");

        _applicationRepositoryMock.Verify(r => r.Update(application), Times.Once);
        _placementRepositoryMock.Verify(r => r.Update(It.IsAny<Placement>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenPlacementAlreadyExists_ShouldThrowConflictException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var initialToken = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = initialToken
        };

        var placement = new Placement
        {
            PlacementId = Guid.NewGuid(),
            ApplicationId = appId,
            Status = "STARTED"
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _placementRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var command = new MarkNotStartedCommand(
            ApplicationId: appId,
            Reason: "Ứng viên nghỉ việc ngay sau ngày đầu",
            ConcurrencyToken: initialToken,
            CurrentUserId: userId,
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>();
        application.Status.Should().Be("OFFER_ACCEPTED");
        placement.Status.Should().Be("STARTED");
        _placementRepositoryMock.Verify(r => r.Update(It.IsAny<Placement>()), Times.Never);
        _applicationRepositoryMock.Verify(r => r.Update(It.IsAny<Domain.Entities.Application>()), Times.Never);
    }
}
