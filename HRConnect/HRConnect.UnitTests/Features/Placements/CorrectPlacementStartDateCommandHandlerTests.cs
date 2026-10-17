using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Placements.Commands.CorrectPlacementStartDate;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Placements;

public sealed class CorrectPlacementStartDateCommandHandlerTests
{
    private readonly Mock<IFinanceRepository> _financeRepository = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditLogService> _auditLog = new();
    private readonly Mock<ILogger<CorrectPlacementStartDateCommandHandler>> _logger = new();

    private CorrectPlacementStartDateCommandHandler CreateHandler() => new(
        _financeRepository.Object,
        _unitOfWork.Object,
        _auditLog.Object,
        _logger.Object);

    [Fact]
    public async Task Handle_WhenActorIsNotInternalHrOrAdmin_ShouldReject()
    {
        var act = () => CreateHandler().Handle(
            new CorrectPlacementStartDateCommand(Guid.NewGuid(), DateOnly.FromDateTime(DateTime.UtcNow), "Nhập nhầm", Guid.NewGuid()),
            default);

        await act.Should().ThrowAsync<ForbiddenException>();
        _financeRepository.Verify(r => r.GetPlacementForFinanceAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenReasonIsMissing_ShouldRejectBeforeChangingPlacement()
    {
        var placement = CreatePlacement();
        _financeRepository.Setup(r => r.GetPlacementForFinanceAsync(placement.PlacementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var act = () => CreateHandler().Handle(
            new CorrectPlacementStartDateCommand(
                placement.PlacementId,
                DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)),
                "   ",
                _actorId,
                IsInternalHrOrAdmin: true),
            default);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*bắt buộc*");
        _financeRepository.Verify(r => r.GetPlacementForFinanceAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenCorrectedDateIsInFuture_ShouldRejectWithInvalidStartDate()
    {
        var placement = CreatePlacement();
        _financeRepository.Setup(r => r.GetPlacementForFinanceAsync(placement.PlacementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var act = () => CreateHandler().Handle(
            CommandFor(placement, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1))),
            default);

        var exception = await act.Should().ThrowAsync<BadRequestException>();
        exception.Which.ErrorCode.Should().Be(PlacementStartDateErrorCodes.InvalidStartDate);
        _financeRepository.Verify(r => r.GetPlacementForFinanceAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenCorrectionIsOutsideSevenDays_ShouldReturnStartDateLocked()
    {
        var placement = CreatePlacement(confirmedAt: DateTime.UtcNow.AddDays(-8));
        _financeRepository.Setup(r => r.GetPlacementForFinanceAsync(placement.PlacementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var act = () => CreateHandler().Handle(CommandFor(placement, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2))), default);

        var exception = await act.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be(PlacementStartDateErrorCodes.StartDateLocked);
    }

    [Fact]
    public async Task Handle_WhenServiceFeeHasBeenPaid_ShouldReturnStartDateLocked()
    {
        var placement = CreatePlacement();
        placement.ServiceFee!.Status = ServiceFeeStates.Paid;
        _financeRepository.Setup(r => r.GetPlacementForFinanceAsync(placement.PlacementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var act = () => CreateHandler().Handle(CommandFor(placement, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2))), default);

        var exception = await act.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be(PlacementStartDateErrorCodes.StartDateLocked);
    }

    [Fact]
    public async Task Handle_WhenNewDateIsBeforeOfferAcceptance_ShouldRejectWithInvalidStartDate()
    {
        var placement = CreatePlacement();
        placement.Offer.RespondedAt = DateTime.UtcNow.AddDays(-3);
        _financeRepository.Setup(r => r.GetPlacementForFinanceAsync(placement.PlacementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var act = () => CreateHandler().Handle(CommandFor(placement, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-4))), default);

        var exception = await act.Should().ThrowAsync<BadRequestException>();
        exception.Which.ErrorCode.Should().Be(PlacementStartDateErrorCodes.InvalidStartDate);
    }

    [Fact]
    public async Task Handle_WhenCorrectionIsAllowed_ShouldShiftWarrantyAndFeeDueDateByTheSameOffset()
    {
        var placement = CreatePlacement();
        _financeRepository.Setup(r => r.GetPlacementForFinanceAsync(placement.PlacementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);
        _unitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var correctedDate = placement.ActualStartDate.AddDays(2);
        var result = await CreateHandler().Handle(CommandFor(placement, correctedDate), default);

        result.PreviousActualStartDate.Should().Be(correctedDate.AddDays(-2));
        result.ActualStartDate.Should().Be(correctedDate);
        result.WarrantyEndDate.Should().Be(correctedDate.AddDays(30));
        result.ServiceFeeDueDate.Should().Be(correctedDate.AddDays(20));
        placement.Warranty!.StartDate.Should().Be(correctedDate);
        placement.Warranty.UpdatedBy.Should().Be(_actorId);
        placement.ServiceFee!.DueDate.Should().Be(correctedDate.AddDays(20));
        _auditLog.Verify(a => a.AddAsync(
            It.Is<HRConnect.Application.Common.Models.AuditEntry>(entry => entry.Action == HRConnect.Application.Common.Models.AuditActions.PlacementStartDateCorrected),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private readonly Guid _actorId = Guid.NewGuid();

    private CorrectPlacementStartDateCommand CommandFor(Placement placement, DateOnly actualStartDate) => new(
        placement.PlacementId,
        actualStartDate,
        "Client nhập nhầm ngày đi làm",
        _actorId,
        IsInternalHrOrAdmin: true);

    private static Placement CreatePlacement(DateTime? confirmedAt = null)
    {
        var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5));
        return new Placement
        {
            PlacementId = Guid.NewGuid(),
            ActualStartDate = startDate,
            ConfirmedAt = confirmedAt ?? DateTime.UtcNow.AddDays(-2),
            Offer = new Offer { OfferId = Guid.NewGuid(), Status = OfferStates.Accepted, RespondedAt = DateTime.UtcNow.AddDays(-10) },
            Warranty = new Warranty
            {
                WarrantyId = Guid.NewGuid(),
                StartDate = startDate,
                EndDate = startDate.AddDays(30),
                Status = WarrantyStates.Active
            },
            ServiceFee = new ServiceFee
            {
                ServiceFeeId = Guid.NewGuid(),
                DueDate = startDate.AddDays(20),
                Status = ServiceFeeStates.Pending
            }
        };
    }
}
