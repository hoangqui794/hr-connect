using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class ConfirmStartWorkCommandHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<IOfferRepository> _offerRepositoryMock = new();
    private readonly Mock<IPlacementRepository> _placementRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<ConfirmStartWorkCommandHandler>> _loggerMock = new();
    private readonly Mock<IAuditLogService> _auditLogServiceMock = new();

    private ConfirmStartWorkCommandHandler CreateHandler() =>
        new(
            _applicationRepositoryMock.Object,
            _offerRepositoryMock.Object,
            _placementRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object,
            _auditLogServiceMock.Object);

    [Fact]
    public async Task Handle_WhenActualStartDateIsInFuture_ShouldThrowBadRequestException()
    {
        // Arrange
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2));
        var command = new ConfirmStartWorkCommand(
            ApplicationId: Guid.NewGuid(),
            OfferId: Guid.NewGuid(),
            ActualStartDate: futureDate,
            ConfirmationNote: "Test",
            Position: "Developer",
            Department: "IT",
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*tương lai*");
    }

    [Fact]
    public async Task Handle_WhenApplicationNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Domain.Entities.Application?)null);

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: Guid.NewGuid(),
            ActualStartDate: today,
            ConfirmationNote: null,
            Position: null,
            Department: null,
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
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: Guid.NewGuid(),
            ActualStartDate: today,
            ConfirmationNote: null,
            Position: null,
            Department: null,
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
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
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

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: Guid.NewGuid(),
            ActualStartDate: today,
            ConfirmationNote: null,
            Position: null,
            Department: null,
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
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

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

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: Guid.NewGuid(),
            ActualStartDate: today,
            ConfirmationNote: null,
            Position: null,
            Department: null,
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
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = terminalStatus,
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: Guid.NewGuid(),
            ActualStartDate: today,
            ConfirmationNote: null,
            Position: null,
            Department: null,
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
    public async Task Handle_WhenPlacementAlreadyExists_ShouldThrowConflictException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _placementRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Placement { PlacementId = Guid.NewGuid(), ApplicationId = appId });

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: Guid.NewGuid(),
            ActualStartDate: today,
            ConfirmationNote: null,
            Position: null,
            Department: null,
            ConcurrencyToken: application.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*đã có thông tin tiếp nhận việc*");
    }

    [Fact]
    public async Task Handle_WhenOfferNotFoundOrMismatchApplication_ShouldThrowBadRequestException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var offerId = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _placementRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Placement?)null);

        _offerRepositoryMock
            .Setup(r => r.GetByIdAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Offer { OfferId = offerId, ApplicationId = Guid.NewGuid() }); // mismatched appId

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: offerId,
            ActualStartDate: today,
            ConfirmationNote: null,
            Position: null,
            Department: null,
            ConcurrencyToken: application.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*không thuộc hồ sơ này*");
    }

    [Fact]
    public async Task Handle_WhenOfferIsNotAccepted_ShouldThrowBadRequestException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var offerId = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _placementRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Placement?)null);

        _offerRepositoryMock
            .Setup(r => r.GetByIdAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Offer { OfferId = offerId, ApplicationId = appId, Status = "PENDING" });

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: offerId,
            ActualStartDate: today,
            ConfirmationNote: null,
            Position: null,
            Department: null,
            ConcurrencyToken: application.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*ACCEPTED*");
    }

    [Fact]
    public async Task Handle_WhenValid_ShouldCreatePlacementAndUpdateApplicationToPlaced()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var offerId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var initialToken = Guid.NewGuid();

        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = initialToken,
            Job = new Job { CompanyId = companyId, Title = "Senior .NET Developer" }
        };

        var offer = new Offer
        {
            OfferId = offerId,
            ApplicationId = appId,
            Status = "ACCEPTED"
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        _placementRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Placement?)null);

        _offerRepositoryMock
            .Setup(r => r.GetByIdAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: offerId,
            ActualStartDate: today,
            ConfirmationNote: "Ứng viên đã đến công ty nhận việc đầy đủ",
            Position: null, // should fall back to job title
            Department: "Product Engineering",
            ConcurrencyToken: initialToken,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        Placement? addedPlacement = null;
        _placementRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Placement>(), It.IsAny<CancellationToken>()))
            .Callback<Placement, CancellationToken>((p, _) => addedPlacement = p)
            .Returns(Task.CompletedTask);

        // Act
        var result = await CreateHandler().Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.ApplicationId.Should().Be(appId);
        result.ApplicationStatus.Should().Be("PLACED");
        result.ActualStartDate.Should().Be(today);
        result.ConcurrencyToken.Should().NotBe(initialToken);
        result.AllowedActions.Should().Contain("VIEW_PLACEMENT");

        addedPlacement.Should().NotBeNull();
        addedPlacement!.ApplicationId.Should().Be(appId);
        addedPlacement.OfferId.Should().Be(offerId);
        addedPlacement.ActualStartDate.Should().Be(today);
        addedPlacement.Position.Should().Be("Senior .NET Developer");
        addedPlacement.Department.Should().Be("Product Engineering");
        addedPlacement.Status.Should().Be("STARTED");
        addedPlacement.ConfirmedBy.Should().Be(userId);
        addedPlacement.ConfirmationNote.Should().Be("Ứng viên đã đến công ty nhận việc đầy đủ");

        application.Status.Should().Be("PLACED");
        application.ApplicationStatusHistories.Should().HaveCount(1);
        application.ApplicationStatusHistories.First().OldStatus.Should().Be("OFFER_ACCEPTED");
        application.ApplicationStatusHistories.First().NewStatus.Should().Be("PLACED");

        _placementRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Placement>(), It.IsAny<CancellationToken>()), Times.Once);
        _applicationRepositoryMock.Verify(r => r.Update(application), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
