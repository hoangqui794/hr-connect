using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Recruitment.Commands.MarkNotStarted;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
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
    private readonly Mock<IAuditLogService> _auditLogServiceMock = new();
    private readonly Mock<IPlacementReconciliationRepository> _reconciliationRepositoryMock = new();
    private readonly Mock<ICandidateRecruitmentDeliveryService> _candidateDeliveryServiceMock = new();

    private MarkNotStartedCommandHandler CreateHandler(bool withDelivery = false) =>
        new(
            _applicationRepositoryMock.Object,
            _placementRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object,
            _auditLogServiceMock.Object,
            _reconciliationRepositoryMock.Object,
            withDelivery ? _candidateDeliveryServiceMock.Object : null);

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
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = userCompanyId, Status = "ACTIVE" });

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
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

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

    [Fact]
    public async Task Handle_WhenHeadhuntCandidateDoesNotStart_ShouldCreatePendingReconciliation()
    {
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = ApplicationStates.OfferAccepted,
            ConcurrencyToken = Guid.NewGuid(),
            Job = new Job
            {
                CompanyId = companyId,
                ServiceType = new ServiceType { Code = ServiceTypeCodes.HeadhuntCod }
            }
        };
        _applicationRepositoryMock.Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>())).ReturnsAsync(application);
        _companyUserRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });
        _placementRepositoryMock.Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Placement?)null);
        _reconciliationRepositoryMock.Setup(r => r.AddAsync(It.IsAny<PlacementReconciliation>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        await CreateHandler().Handle(new MarkNotStartedCommand(
            appId, "Ứng viên không đến nhận việc.", application.ConcurrencyToken, userId, IsClientCompanyUser: true), default);

        _reconciliationRepositoryMock.Verify(r => r.AddAsync(
            It.Is<PlacementReconciliation>(item =>
                item.ApplicationId == appId &&
                item.PlacementId == null &&
                item.ClaimedOutcome == PlacementReconciliationOutcomes.NotStarted &&
                item.Status == PlacementReconciliationStates.Pending),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCandidateIsReachable_ShouldDeliverNotStartedNotice()
    {
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var candidate = new Candidate { UserId = Guid.NewGuid(), Email = "candidate@example.com" };
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = ApplicationStates.OfferAccepted,
            ConcurrencyToken = Guid.NewGuid(),
            Candidate = candidate,
            Job = new Job
            {
                CompanyId = companyId,
                Title = "Backend Developer",
                ServiceType = new ServiceType { Code = ServiceTypeCodes.HeadhuntCod }
            }
        };
        _applicationRepositoryMock.Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>())).ReturnsAsync(application);
        _companyUserRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });
        _placementRepositoryMock.Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Placement?)null);
        _candidateDeliveryServiceMock.Setup(s => s.DeliverApplicationOutcomeAsync(
                application, ApplicationCandidateDeliveryEvent.NotStartedReported, "Ứng viên không đến.",
                It.IsAny<DateTime>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateRecruitmentDeliveryOutcome(CandidateRecruitmentDeliveryChannel.InApp));

        var result = await CreateHandler(withDelivery: true).Handle(new MarkNotStartedCommand(
            appId, "Ứng viên không đến.", application.ConcurrencyToken, userId, IsClientCompanyUser: true), default);

        result.DeliveryChannel.Should().Be("IN_APP");
        _candidateDeliveryServiceMock.Verify(s => s.DeliverApplicationOutcomeAsync(
            application, ApplicationCandidateDeliveryEvent.NotStartedReported, "Ứng viên không đến.",
            It.IsAny<DateTime>(), null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenPreviousOutcomeWasReopened_ShouldReuseReconciliationForNotStartedOutcome()
    {
        var appId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = ApplicationStates.OfferAccepted,
            ConcurrencyToken = Guid.NewGuid(),
            Job = new Job
            {
                CompanyId = companyId,
                ServiceType = new ServiceType { Code = ServiceTypeCodes.HeadhuntCod }
            }
        };
        var previousToken = Guid.NewGuid();
        var reconciliation = new PlacementReconciliation
        {
            ReconciliationId = Guid.NewGuid(),
            ApplicationId = appId,
            PlacementId = Guid.NewGuid(),
            ClaimedOutcome = PlacementReconciliationOutcomes.Started,
            Status = PlacementReconciliationStates.Confirmed,
            ResolutionAction = PlacementReconciliationResolutionActions.ReopenForClientConfirmation,
            ResolutionNote = "Client must confirm again.",
            ReviewedBy = Guid.NewGuid(),
            ReviewedAt = DateTime.UtcNow.AddMinutes(-10),
            ConcurrencyToken = previousToken,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow.AddMinutes(-10)
        };
        _applicationRepositoryMock.Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        _companyUserRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });
        _placementRepositoryMock.Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Placement?)null);
        _reconciliationRepositoryMock.Setup(r => r.GetByApplicationIdAsync(
                appId,
                true,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(reconciliation);

        await CreateHandler().Handle(new MarkNotStartedCommand(
            appId, "Ứng viên xác nhận không đến nhận việc.", application.ConcurrencyToken,
            userId, IsClientCompanyUser: true), default);

        reconciliation.PlacementId.Should().BeNull();
        reconciliation.ClaimedOutcome.Should().Be(PlacementReconciliationOutcomes.NotStarted);
        reconciliation.Status.Should().Be(PlacementReconciliationStates.Pending);
        reconciliation.ResolutionAction.Should().BeNull();
        reconciliation.ResolutionNote.Should().BeNull();
        reconciliation.ReviewedBy.Should().BeNull();
        reconciliation.ReviewedAt.Should().BeNull();
        reconciliation.ConcurrencyToken.Should().NotBe(previousToken);
        _reconciliationRepositoryMock.Verify(
            r => r.AddAsync(It.IsAny<PlacementReconciliation>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
