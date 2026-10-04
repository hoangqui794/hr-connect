using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Offers.Commands.SendOffer;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Offers;

public class SendOfferCommandHandlerTests
{
    private readonly Mock<IOfferRepository> _offerRepositoryMock = new();
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<SendOfferCommandHandler>> _loggerMock = new();
    private readonly Mock<IAuditLogService> _auditLogServiceMock = new();

    private SendOfferCommandHandler CreateHandler() =>
        new(
            _offerRepositoryMock.Object,
            _applicationRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object,
            _auditLogServiceMock.Object);

    [Fact]
    public async Task Handle_WhenOfferNotFound_ShouldThrowNotFoundException()
    {
        var offerId = Guid.NewGuid();
        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Offer?)null);

        var command = new SendOfferCommand(
            OfferId: offerId,
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
            Status = "DRAFT",
            ConcurrencyToken = Guid.NewGuid()
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new SendOfferCommand(
            OfferId: offerId,
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
            Status = "DRAFT",
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
            .ReturnsAsync(new CompanyUser { CompanyId = companyB });

        var command = new SendOfferCommand(
            OfferId: offerId,
            ConcurrencyToken: null,
            CurrentUserId: clientUserId,
            IsClientCompanyUser: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Bạn không có quyền gửi offer của doanh nghiệp khác*");
    }

    [Fact]
    public async Task Handle_WhenOfferStatusIsNotDraft_ShouldThrowBadRequestException()
    {
        var offerId = Guid.NewGuid();
        var offer = new Offer
        {
            OfferId = offerId,
            Status = "SENT" // Already sent
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new SendOfferCommand(
            OfferId: offerId,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Chỉ có thể gửi offer khi đang ở trạng thái DRAFT*");
    }

    [Fact]
    public async Task Handle_WhenExpiryDateIsInThePast_ShouldThrowBadRequestException()
    {
        var offerId = Guid.NewGuid();
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        var offer = new Offer
        {
            OfferId = offerId,
            Status = "DRAFT",
            ExpiryDate = yesterday
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new SendOfferCommand(
            OfferId: offerId,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Offer đã quá hạn phản hồi, không thể gửi*");
    }

    [Fact]
    public async Task Handle_WhenSuccessful_ShouldSetStatusToSent_AndSentAt_AndSave()
    {
        var offerId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var tomorrow = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));

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
            Status = "DRAFT",
            ExpiryDate = tomorrow,
            Salary = 20000000,
            CurrencyCode = "VND",
            ConcurrencyToken = Guid.NewGuid(),
            Application = app
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = companyId });

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new SendOfferCommand(
            OfferId: offerId,
            ConcurrencyToken: offer.ConcurrencyToken,
            CurrentUserId: clientUserId,
            IsClientCompanyUser: true);

        var result = await CreateHandler().Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.OfferId.Should().Be(offerId);
        result.Status.Should().Be("SENT");
        result.SentAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));

        offer.Status.Should().Be("SENT");
        offer.SentAt.Should().NotBeNull();

        _offerRepositoryMock.Verify(r => r.Update(offer), Times.Once);
        _applicationRepositoryMock.Verify(r => r.Update(app), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
