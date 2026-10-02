using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Offers.Commands.RespondToOffer;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Offers;

public class RespondToOfferCommandHandlerTests
{
    private readonly Mock<IOfferRepository> _offerRepositoryMock = new();
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<RespondToOfferCommandHandler>> _loggerMock = new();

    private RespondToOfferCommandHandler CreateHandler() =>
        new(
            _offerRepositoryMock.Object,
            _applicationRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenResponseIsEmpty_ShouldThrowBadRequestException()
    {
        var command = new RespondToOfferCommand(
            OfferId: Guid.NewGuid(),
            Response: "",
            DeclineReason: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid());

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Phản hồi không được để trống*");
    }

    [Fact]
    public async Task Handle_WhenResponseIsInvalid_ShouldThrowBadRequestException()
    {
        var command = new RespondToOfferCommand(
            OfferId: Guid.NewGuid(),
            Response: "MAYBE",
            DeclineReason: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid());

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Phải là ACCEPTED hoặc DECLINED*");
    }

    [Fact]
    public async Task Handle_WhenDeclinedWithoutReason_ShouldThrowBadRequestException()
    {
        var command = new RespondToOfferCommand(
            OfferId: Guid.NewGuid(),
            Response: "DECLINED",
            DeclineReason: "   ",
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid());

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Vui lòng cung cấp lý do từ chối offer*");
    }

    [Fact]
    public async Task Handle_WhenOfferNotFound_ShouldThrowNotFoundException()
    {
        var offerId = Guid.NewGuid();
        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Offer?)null);

        var command = new RespondToOfferCommand(
            OfferId: offerId,
            Response: "ACCEPTED",
            DeclineReason: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid());

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy lời mời nhận việc*");
    }

    [Fact]
    public async Task Handle_WhenUserIsNotCandidateOwner_ShouldThrowForbiddenException()
    {
        var offerId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var currentUserId = Guid.NewGuid(); // Different user

        var offer = new Offer
        {
            OfferId = offerId,
            Status = "SENT",
            Application = new HRConnect.Domain.Entities.Application
            {
                Candidate = new Candidate { UserId = candidateUserId }
            }
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new RespondToOfferCommand(
            OfferId: offerId,
            Response: "ACCEPTED",
            DeclineReason: null,
            ConcurrencyToken: null,
            CurrentUserId: currentUserId);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Chỉ ứng viên sở hữu lời mời nhận việc này mới có quyền phản hồi*");
    }

    [Fact]
    public async Task Handle_WhenConcurrencyTokenMismatch_ShouldThrowConflictException()
    {
        var offerId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();

        var offer = new Offer
        {
            OfferId = offerId,
            Status = "SENT",
            ConcurrencyToken = Guid.NewGuid(),
            Application = new HRConnect.Domain.Entities.Application
            {
                Candidate = new Candidate { UserId = candidateUserId }
            }
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new RespondToOfferCommand(
            OfferId: offerId,
            Response: "ACCEPTED",
            DeclineReason: null,
            ConcurrencyToken: Guid.NewGuid(), // Mismatched
            CurrentUserId: candidateUserId);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Dữ liệu offer đã bị thay đổi bởi người khác*");
    }

    [Fact]
    public async Task Handle_WhenOfferStatusIsNotSent_ShouldThrowBadRequestException()
    {
        var offerId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();

        var offer = new Offer
        {
            OfferId = offerId,
            Status = "DRAFT", // Not SENT
            Application = new HRConnect.Domain.Entities.Application
            {
                Candidate = new Candidate { UserId = candidateUserId }
            }
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new RespondToOfferCommand(
            OfferId: offerId,
            Response: "ACCEPTED",
            DeclineReason: null,
            ConcurrencyToken: null,
            CurrentUserId: candidateUserId);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Chỉ có thể phản hồi khi offer đang ở trạng thái SENT*");
    }

    [Fact]
    public async Task Handle_WhenOfferIsExpired_ShouldThrowBadRequestException()
    {
        var offerId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));

        var offer = new Offer
        {
            OfferId = offerId,
            Status = "SENT",
            ExpiryDate = yesterday,
            Application = new HRConnect.Domain.Entities.Application
            {
                Candidate = new Candidate { UserId = candidateUserId }
            }
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new RespondToOfferCommand(
            OfferId: offerId,
            Response: "ACCEPTED",
            DeclineReason: null,
            ConcurrencyToken: null,
            CurrentUserId: candidateUserId);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Lời mời nhận việc đã hết hạn phản hồi*");
    }

    [Fact]
    public async Task Handle_WhenAccepted_ShouldSetStatusToAccepted_AndTransitionApplicationStatus()
    {
        var offerId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14));

        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            Status = "OFFER_PENDING",
            Candidate = new Candidate { UserId = candidateUserId }
        };

        var offer = new Offer
        {
            OfferId = offerId,
            ApplicationId = app.ApplicationId,
            OfferVersion = 1,
            Status = "SENT",
            StartDate = startDate,
            ConcurrencyToken = Guid.NewGuid(),
            Application = app
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new RespondToOfferCommand(
            OfferId: offerId,
            Response: "ACCEPTED",
            DeclineReason: null,
            ConcurrencyToken: offer.ConcurrencyToken,
            CurrentUserId: candidateUserId);

        var result = await CreateHandler().Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Status.Should().Be("ACCEPTED");
        result.ApplicationStatus.Should().Be("OFFER_ACCEPTED");
        result.PlannedStartDate.Should().Be(startDate);

        offer.Status.Should().Be("ACCEPTED");
        offer.RespondedAt.Should().NotBeNull();
        app.Status.Should().Be("OFFER_ACCEPTED");
        app.PlannedStartDate.Should().Be(startDate);
        app.ApplicationStatusHistories.Should().ContainSingle(h => h.NewStatus == "OFFER_ACCEPTED");

        _offerRepositoryMock.Verify(r => r.Update(offer), Times.Once);
        _applicationRepositoryMock.Verify(r => r.Update(app), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenDeclined_ShouldSetStatusToDeclined_WithReason_AndTransitionApplicationStatus()
    {
        var offerId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();

        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            Status = "OFFER_PENDING",
            Candidate = new Candidate { UserId = candidateUserId }
        };

        var offer = new Offer
        {
            OfferId = offerId,
            ApplicationId = app.ApplicationId,
            OfferVersion = 1,
            Status = "SENT",
            ConcurrencyToken = Guid.NewGuid(),
            Application = app
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new RespondToOfferCommand(
            OfferId: offerId,
            Response: "DECLINED",
            DeclineReason: "Mức lương chưa phù hợp với kỳ vọng",
            ConcurrencyToken: offer.ConcurrencyToken,
            CurrentUserId: candidateUserId);

        var result = await CreateHandler().Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Status.Should().Be("DECLINED");
        result.DeclineReason.Should().Be("Mức lương chưa phù hợp với kỳ vọng");
        result.ApplicationStatus.Should().Be("OFFER_DECLINED");

        offer.Status.Should().Be("DECLINED");
        offer.DeclineReason.Should().Be("Mức lương chưa phù hợp với kỳ vọng");
        offer.RespondedAt.Should().NotBeNull();
        app.Status.Should().Be("OFFER_DECLINED");
        app.ApplicationStatusHistories.Should().ContainSingle(h => h.NewStatus == "OFFER_DECLINED");

        _offerRepositoryMock.Verify(r => r.Update(offer), Times.Once);
        _applicationRepositoryMock.Verify(r => r.Update(app), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
