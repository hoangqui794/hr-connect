using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;
using HRConnect.Domain.Constants;
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
    private readonly Mock<IPlacementFinanceService> _placementFinanceServiceMock = CreateFinanceMock();
    private readonly Mock<IFinanceRepository> _financeRepositoryMock = new();

    private static Mock<IPlacementFinanceService> CreateFinanceMock()
    {
        var mock = new Mock<IPlacementFinanceService>();
        mock.Setup(s => s.InitializeAsync(It.IsAny<Placement>(), It.IsAny<JobApplicationContext>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlacementFinanceResult(false, null, null, null, null, null, null, Array.Empty<string>()));
        return mock;
    }

    private ConfirmStartWorkCommandHandler CreateHandler() =>
        new(
            _applicationRepositoryMock.Object,
            _offerRepositoryMock.Object,
            _placementRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object,
            _auditLogServiceMock.Object,
            _placementFinanceServiceMock.Object,
            _financeRepositoryMock.Object);

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
        var exception = await act.Should().ThrowAsync<BadRequestException>();
        exception.Which.Message.Should().Contain("tương lai");
        exception.Which.ErrorCode.Should().Be(PlacementStartDateErrorCodes.InvalidStartDate);
    }

    [Theory]
    [InlineData(181, 0, "*Vị trí tiếp nhận không được vượt quá 180 ký tự*")]
    [InlineData(0, 181, "*Bộ phận tiếp nhận không được vượt quá 180 ký tự*")]
    public async Task Handle_WhenPlacementTextExceedsDatabaseLimit_ShouldThrowBadRequestException(
        int positionLength,
        int departmentLength,
        string expectedMessage)
    {
        var command = new ConfirmStartWorkCommand(
            ApplicationId: Guid.NewGuid(),
            OfferId: Guid.NewGuid(),
            ActualStartDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ConfirmationNote: null,
            Position: positionLength == 0 ? null : new string('P', positionLength),
            Department: departmentLength == 0 ? null : new string('D', departmentLength),
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsClientCompanyUser: true);

        Func<Task> act = () => CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage(expectedMessage);
        _applicationRepositoryMock.Verify(
            repository => repository.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
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
        var offerId = Guid.NewGuid();
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

        _offerRepositoryMock
            .Setup(r => r.GetByIdAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Offer { OfferId = offerId, ApplicationId = appId, Status = "ACCEPTED" });

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: offerId,
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
        var offerId = Guid.NewGuid();
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

        _offerRepositoryMock
            .Setup(r => r.GetByIdAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Offer { OfferId = offerId, ApplicationId = appId, Status = "ACCEPTED" });

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = userCompanyId, Status = "ACTIVE" });

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: offerId,
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

    [Fact]
    public async Task Handle_WhenApplicationJobIsMissing_ShouldThrowConflictException()
    {
        var appId = Guid.NewGuid();
        var offerId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            JobId = Guid.NewGuid(),
            Status = "OFFER_ACCEPTED",
            ConcurrencyToken = Guid.NewGuid(),
            Job = null!
        };

        _applicationRepositoryMock
            .Setup(repository => repository.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        _offerRepositoryMock
            .Setup(repository => repository.GetByIdAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Offer { OfferId = offerId, ApplicationId = appId, Status = "ACCEPTED" });
        _companyUserRepositoryMock
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

        var command = new ConfirmStartWorkCommand(
            ApplicationId: appId,
            OfferId: offerId,
            ActualStartDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ConfirmationNote: null,
            Position: null,
            Department: null,
            ConcurrencyToken: application.ConcurrencyToken,
            CurrentUserId: userId,
            IsClientCompanyUser: true);

        Func<Task> act = () => CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*không còn liên kết với công việc hợp lệ*");
        _placementRepositoryMock.Verify(
            repository => repository.AddAsync(It.IsAny<Placement>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _unitOfWorkMock.Verify(
            unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()),
            Times.Never);
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
    public async Task Handle_WhenActualStartDateIsBeforeOfferAcceptance_ShouldReturnInvalidStartDate()
    {
        var appId = Guid.NewGuid();
        var offerId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var acceptedAt = DateTime.UtcNow.AddDays(-2);
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = ApplicationStates.OfferAccepted,
            ConcurrencyToken = Guid.NewGuid(),
            Job = new Job { CompanyId = companyId }
        };
        var offer = new Offer
        {
            OfferId = offerId,
            ApplicationId = appId,
            Status = OfferStates.Accepted,
            RespondedAt = acceptedAt
        };

        _applicationRepositoryMock.Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>())).ReturnsAsync(application);
        _placementRepositoryMock.Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>())).ReturnsAsync((Placement?)null);
        _offerRepositoryMock.Setup(r => r.GetByIdAsync(offerId, It.IsAny<CancellationToken>())).ReturnsAsync(offer);

        var act = () => CreateHandler().Handle(new ConfirmStartWorkCommand(
            appId,
            offerId,
            DateOnly.FromDateTime(acceptedAt.AddDays(-1)),
            null,
            null,
            null,
            application.ConcurrencyToken,
            userId,
            IsClientCompanyUser: true), default);

        var exception = await act.Should().ThrowAsync<BadRequestException>();
        exception.Which.ErrorCode.Should().Be(PlacementStartDateErrorCodes.InvalidStartDate);
        _companyUserRepositoryMock.Verify(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
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
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

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

    [Fact]
    public async Task Handle_WhenReplacementSlotIsOpen_ShouldFillSlotAndSuppressNewHireClassification()
    {
        var slotId = Guid.NewGuid();
        var fixture = ArrangeValidClientStart(slotId);
        var originalPlacementId = Guid.NewGuid();
        var slot = new ReplacementSlot
        {
            ReplacementSlotId = slotId,
            JobId = fixture.Application.JobId,
            OriginalPlacementId = originalPlacementId,
            ServiceFeeId = Guid.NewGuid(),
            Status = ReplacementSlotStates.Open,
            OpenedAt = DateTime.UtcNow.AddDays(-1),
            ExpiresAt = DateTime.UtcNow.AddDays(10),
            ConcurrencyToken = Guid.NewGuid()
        };
        var sourceFee = new ServiceFee
        {
            ServiceFeeId = slot.ServiceFeeId,
            Status = ServiceFeeStates.Paid,
            Amount = 30_000_000m,
            CurrencyCode = "VND"
        };
        JobApplicationContext? capturedContext = null;
        Placement? createdPlacement = null;

        _financeRepositoryMock
            .Setup(r => r.GetReplacementSlotForPlacementForUpdateAsync(slotId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(slot);
        _financeRepositoryMock
            .Setup(r => r.GetServiceFeeForUpdateAsync(slot.ServiceFeeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(sourceFee);
        _placementRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Placement>(), It.IsAny<CancellationToken>()))
            .Callback<Placement, CancellationToken>((placement, _) => createdPlacement = placement)
            .Returns(Task.CompletedTask);
        _placementFinanceServiceMock
            .Setup(s => s.InitializeAsync(It.IsAny<Placement>(), It.IsAny<JobApplicationContext>(), fixture.UserId, It.IsAny<CancellationToken>()))
            .Callback<Placement, JobApplicationContext, Guid, CancellationToken>((_, context, _, _) => capturedContext = context)
            .ReturnsAsync(new PlacementFinanceResult(true, Guid.NewGuid(), DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)), null, null, Guid.NewGuid(), 9_000_000m, []));
        _unitOfWorkMock.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _unitOfWorkMock.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var response = await CreateHandler().Handle(fixture.CreateCommand(false), CancellationToken.None);

        response.IsReplacement.Should().BeTrue();
        response.ReplacementSlotId.Should().Be(slotId);
        response.ReplacesPlacementId.Should().Be(originalPlacementId);
        response.AcceptedAsNewHire.Should().BeFalse();
        createdPlacement.Should().NotBeNull();
        createdPlacement!.ReplacementSlotId.Should().Be(slotId);
        slot.Status.Should().Be(ReplacementSlotStates.Filled);
        slot.FilledByPlacementId.Should().Be(createdPlacement.PlacementId);
        slot.ClosedBy.Should().Be(fixture.UserId);
        slot.ClosedAt.Should().NotBeNull();
        capturedContext.Should().NotBeNull();
        capturedContext!.ReplacementSourceServiceFee.Should().BeSameAs(sourceFee);
        _unitOfWorkMock.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenAnotherCandidateAlreadyFilledTheSlot_ShouldReturnReplacementSlotAlreadyFilled()
    {
        var slotId = Guid.NewGuid();
        var fixture = ArrangeValidClientStart(slotId);
        var filledSlot = new ReplacementSlot
        {
            ReplacementSlotId = slotId,
            JobId = fixture.Application.JobId,
            ServiceFeeId = Guid.NewGuid(),
            Status = ReplacementSlotStates.Filled,
            ExpiresAt = DateTime.UtcNow.AddDays(10)
        };

        _financeRepositoryMock
            .Setup(r => r.GetReplacementSlotForPlacementForUpdateAsync(slotId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(filledSlot);
        _unitOfWorkMock.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _unitOfWorkMock.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var act = () => CreateHandler().Handle(fixture.CreateCommand(false), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be(ReplacementSlotErrorCodes.AlreadyFilled);
        _placementRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Placement>(), It.IsAny<CancellationToken>()), Times.Never);
        _placementFinanceServiceMock.Verify(s => s.InitializeAsync(It.IsAny<Placement>(), It.IsAny<JobApplicationContext>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenClientAcceptsReplacementCandidateAsNewHire_ShouldNotConsumeTheSlot()
    {
        var fixture = ArrangeValidClientStart(Guid.NewGuid());
        Placement? createdPlacement = null;
        JobApplicationContext? capturedContext = null;

        _placementRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Placement>(), It.IsAny<CancellationToken>()))
            .Callback<Placement, CancellationToken>((placement, _) => createdPlacement = placement)
            .Returns(Task.CompletedTask);
        _placementFinanceServiceMock
            .Setup(s => s.InitializeAsync(It.IsAny<Placement>(), It.IsAny<JobApplicationContext>(), fixture.UserId, It.IsAny<CancellationToken>()))
            .Callback<Placement, JobApplicationContext, Guid, CancellationToken>((_, context, _, _) => capturedContext = context)
            .ReturnsAsync(new PlacementFinanceResult(true, Guid.NewGuid(), null, Guid.NewGuid(), 30_000_000m, null, null, []));
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var response = await CreateHandler().Handle(fixture.CreateCommand(true), CancellationToken.None);

        response.IsReplacement.Should().BeFalse();
        response.ReplacementSlotId.Should().BeNull();
        response.AcceptedAsNewHire.Should().BeTrue();
        createdPlacement.Should().NotBeNull();
        createdPlacement!.ReplacementSlotId.Should().BeNull();
        capturedContext.Should().NotBeNull();
        capturedContext!.ReplacementSourceServiceFee.Should().BeNull();
        _financeRepositoryMock.Verify(r => r.GetReplacementSlotForPlacementForUpdateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private (Domain.Entities.Application Application, Offer Offer, Guid UserId, Func<bool, ConfirmStartWorkCommand> CreateCommand) ArrangeValidClientStart(Guid? replacementSlotId)
    {
        var applicationId = Guid.NewGuid();
        var offerId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = applicationId,
            Status = ApplicationStates.OfferAccepted,
            ConcurrencyToken = Guid.NewGuid(),
            ReplacementSlotId = replacementSlotId,
            Job = new Job
            {
                JobId = Guid.NewGuid(),
                CompanyId = companyId,
                Title = "Backend Developer"
            }
        };
        application.JobId = application.Job.JobId;
        var offer = new Offer
        {
            OfferId = offerId,
            ApplicationId = applicationId,
            Status = OfferStates.Accepted,
            RespondedAt = DateTime.UtcNow.AddDays(-1)
        };

        _applicationRepositoryMock.Setup(r => r.GetByIdAsync(applicationId, It.IsAny<CancellationToken>())).ReturnsAsync(application);
        _placementRepositoryMock.Setup(r => r.GetByApplicationIdAsync(applicationId, It.IsAny<CancellationToken>())).ReturnsAsync((Placement?)null);
        _offerRepositoryMock.Setup(r => r.GetByIdAsync(offerId, It.IsAny<CancellationToken>())).ReturnsAsync(offer);
        _companyUserRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

        ConfirmStartWorkCommand CreateCommand(bool acceptAsNewHire = false) => new(
            applicationId,
            offerId,
            DateOnly.FromDateTime(DateTime.UtcNow),
            "Đã đi làm",
            null,
            null,
            application.ConcurrencyToken,
            userId,
            IsClientCompanyUser: true,
            AcceptAsNewHire: acceptAsNewHire);

        return (application, offer, userId, CreateCommand);
    }
}
