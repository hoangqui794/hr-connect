using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Commands.ConfirmPlannedStartDate;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class ConfirmPlannedStartDateCommandHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<ConfirmPlannedStartDateCommandHandler>> _loggerMock = new();

    private ConfirmPlannedStartDateCommandHandler CreateHandler() =>
        new(
            _applicationRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenPlannedStartDateIsInPast_ShouldThrowBadRequestException()
    {
        // Arrange
        var pastDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        var command = new ConfirmPlannedStartDateCommand(
            ApplicationId: Guid.NewGuid(),
            PlannedStartDate: pastDate,
            Reason: "Test",
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*quá khứ*");
    }

    [Fact]
    public async Task Handle_WhenApplicationNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Domain.Entities.Application?)null);

        var command = new ConfirmPlannedStartDateCommand(
            ApplicationId: appId,
            PlannedStartDate: futureDate,
            Reason: "Test",
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
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new ConfirmPlannedStartDateCommand(
            ApplicationId: appId,
            PlannedStartDate: futureDate,
            Reason: "Test",
            ConcurrencyToken: Guid.NewGuid(), // different token
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
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
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

        var command = new ConfirmPlannedStartDateCommand(
            ApplicationId: appId,
            PlannedStartDate: futureDate,
            Reason: null,
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
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));

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

        var command = new ConfirmPlannedStartDateCommand(
            ApplicationId: appId,
            PlannedStartDate: futureDate,
            Reason: null,
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

    [Theory]
    [InlineData("REJECTED")]
    [InlineData("WITHDRAWN")]
    [InlineData("NOT_STARTED")]
    [InlineData("INTERVIEW_FAILED")]
    [InlineData("BACKUP_NOT_SELECTED")]
    [InlineData("CLOSED")]
    public async Task Handle_WhenApplicationIsInTerminalStatus_ShouldThrowBadRequestException(string terminalStatus)
    {
        // Arrange
        var appId = Guid.NewGuid();
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = terminalStatus,
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new ConfirmPlannedStartDateCommand(
            ApplicationId: appId,
            PlannedStartDate: futureDate,
            Reason: "Test",
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
    public async Task Handle_WhenValidClientUser_ShouldUpdatePlannedStartDateAndReturnSuccess()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14));
        var initialToken = Guid.NewGuid();

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

        var command = new ConfirmPlannedStartDateCommand(
            ApplicationId: appId,
            PlannedStartDate: futureDate,
            Reason: "Chốt ngày đi làm chính thức",
            ConcurrencyToken: initialToken,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.ApplicationId.Should().Be(appId);
        result.PlannedStartDate.Should().Be(futureDate);
        result.Status.Should().Be("OFFER_ACCEPTED");
        result.StatusReason.Should().Be("Chốt ngày đi làm chính thức");
        result.ConcurrencyToken.Should().NotBe(initialToken);

        _applicationRepositoryMock.Verify(r => r.Update(application), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
