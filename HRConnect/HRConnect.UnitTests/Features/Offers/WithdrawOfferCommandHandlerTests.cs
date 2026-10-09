using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Offers.Commands.WithdrawOffer;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Offers;

public class WithdrawOfferCommandHandlerTests
{
    private readonly Mock<IOfferRepository> _offerRepositoryMock = new();
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<WithdrawOfferCommandHandler>> _loggerMock = new();
    private readonly Mock<IAuditLogService> _auditLogServiceMock = new();

    private WithdrawOfferCommandHandler CreateHandler() =>
        new(
            _offerRepositoryMock.Object,
            _applicationRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object,
            _auditLogServiceMock.Object);

    [Fact]
    public async Task Handle_WhenReasonIsEmpty_ShouldThrowBadRequestException()
    {
        var command = new WithdrawOfferCommand(
            OfferId: Guid.NewGuid(),
            Reason: "   ",
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Vui lòng cung cấp lý do thu hồi offer*");
    }

    [Fact]
    public async Task Handle_WhenOfferNotFound_ShouldThrowNotFoundException()
    {
        var offerId = Guid.NewGuid();
        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Offer?)null);

        var command = new WithdrawOfferCommand(
            OfferId: offerId,
            Reason: "Thay đổi kế hoạch nhân sự",
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy lời mời nhận việc*");
    }

    [Fact]
    public async Task Handle_WhenConcurrencyTokenMismatch_ShouldThrowConflictException()
    {
        var offerId = Guid.NewGuid();
        var offer = new Offer
        {
            OfferId = offerId,
            Status = "SENT",
            ConcurrencyToken = Guid.NewGuid()
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new WithdrawOfferCommand(
            OfferId: offerId,
            Reason: "Thay đổi kế hoạch",
            ConcurrencyToken: Guid.NewGuid(), // Mismatched
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Dữ liệu offer đã bị thay đổi bởi người khác*");
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUserFromDifferentCompany_ShouldThrowForbiddenException()
    {
        var offerId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var companyA = Guid.NewGuid();
        var companyB = Guid.NewGuid();

        var offer = new Offer
        {
            OfferId = offerId,
            Status = "SENT",
            Application = new HRConnect.Domain.Entities.Application
            {
                Job = new Job { CompanyId = companyA }
            }
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = companyB, Status = "ACTIVE" });

        var command = new WithdrawOfferCommand(
            OfferId: offerId,
            Reason: "Thu hồi",
            ConcurrencyToken: offer.ConcurrencyToken,
            CurrentUserId: clientUserId,
            IsClientCompanyUser: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Bạn không có quyền thu hồi offer của doanh nghiệp khác*");
    }

    [Fact]
    public async Task Handle_WhenOfferIsAccepted_ShouldThrowBadRequestException()
    {
        var offerId = Guid.NewGuid();
        var offer = new Offer
        {
            OfferId = offerId,
            Status = "ACCEPTED"
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new WithdrawOfferCommand(
            OfferId: offerId,
            Reason: "Thu hồi",
            ConcurrencyToken: offer.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Không thể thu hồi offer đã được ứng viên chấp nhận*");
    }

    [Fact]
    public async Task Handle_WhenOfferIsAlreadyWithdrawnOrDeclined_ShouldThrowBadRequestException()
    {
        var offerId = Guid.NewGuid();
        var offer = new Offer
        {
            OfferId = offerId,
            Status = "WITHDRAWN"
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new WithdrawOfferCommand(
            OfferId: offerId,
            Reason: "Thu hồi lại",
            ConcurrencyToken: offer.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Không thể thu hồi offer đang ở trạng thái WITHDRAWN*");
    }

    [Fact]
    public async Task Handle_WhenOfferIsExpired_ShouldPreserveExpiredStatus()
    {
        var offerId = Guid.NewGuid();
        var offer = new Offer
        {
            OfferId = offerId,
            Status = "EXPIRED"
        };

        _offerRepositoryMock
            .Setup(repository => repository.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new WithdrawOfferCommand(
            OfferId: offerId,
            Reason: "Thu hồi offer đã hết hạn",
            ConcurrencyToken: offer.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsClientCompanyUser: true);

        Func<Task> act = () => CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Không thể thu hồi offer đang ở trạng thái EXPIRED*");
        offer.Status.Should().Be("EXPIRED");
        _offerRepositoryMock.Verify(repository => repository.Update(It.IsAny<Offer>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenSuccessful_ShouldSetStatusToWithdrawn_AndSave()
    {
        var offerId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            Status = "OFFER_PENDING",
            Job = new Job { CompanyId = companyId }
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

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = companyId, Status = "ACTIVE" });

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new WithdrawOfferCommand(
            OfferId: offerId,
            Reason: "Thay đổi kế hoạch tuyển dụng dự án",
            ConcurrencyToken: offer.ConcurrencyToken,
            CurrentUserId: clientUserId,
            IsClientCompanyUser: true);

        var result = await CreateHandler().Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.OfferId.Should().Be(offerId);
        result.Status.Should().Be("WITHDRAWN");
        result.Reason.Should().Be("Thay đổi kế hoạch tuyển dụng dự án");
        result.ApplicationStatus.Should().Be("OFFER_PENDING");

        offer.Status.Should().Be("WITHDRAWN");
        offer.DeclineReason.Should().Be("Thay đổi kế hoạch tuyển dụng dự án");
        app.Status.Should().Be("OFFER_PENDING");
        app.ApplicationStatusHistories.Should().ContainSingle(h => h.NewStatus == "OFFER_PENDING");

        _offerRepositoryMock.Verify(r => r.Update(offer), Times.Once);
        _applicationRepositoryMock.Verify(r => r.Update(app), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
