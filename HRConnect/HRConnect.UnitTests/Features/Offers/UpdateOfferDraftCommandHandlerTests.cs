using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Offers.Commands.UpdateOfferDraft;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Offers;

public class UpdateOfferDraftCommandHandlerTests
{
    private readonly Mock<IOfferRepository> _offerRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<UpdateOfferDraftCommandHandler>> _loggerMock = new();
    private readonly Mock<IAuditLogService> _auditLogServiceMock = new();

    private UpdateOfferDraftCommandHandler CreateHandler() =>
        new(
            _offerRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object,
            _auditLogServiceMock.Object);

    [Fact]
    public async Task Handle_WhenSalaryIsNegative_ShouldThrowBadRequestException()
    {
        var command = new UpdateOfferDraftCommand(
            OfferId: Guid.NewGuid(),
            Salary: -500,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Mức lương không được là số âm*");
    }

    [Fact]
    public async Task Handle_WhenExpiryDateIsInThePast_ShouldThrowBadRequestException()
    {
        var pastDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        var command = new UpdateOfferDraftCommand(
            OfferId: Guid.NewGuid(),
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: pastDate,
            OfferDocumentUrl: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Hạn phản hồi offer không được ở quá khứ*");
    }

    [Fact]
    public async Task Handle_WhenStartDateIsBeforeExpiryDate_ShouldThrowBadRequestException()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var expiryDate = today.AddDays(10);
        var startDate = today.AddDays(3);

        var command = new UpdateOfferDraftCommand(
            OfferId: Guid.NewGuid(),
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: startDate,
            ExpiryDate: expiryDate,
            OfferDocumentUrl: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Ngày bắt đầu làm việc dự kiến không được trước hạn phản hồi offer*");
    }

    [Fact]
    public async Task Handle_WhenOfferNotFound_ShouldThrowNotFoundException()
    {
        var offerId = Guid.NewGuid();
        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Offer?)null);

        var command = new UpdateOfferDraftCommand(
            OfferId: offerId,
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
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

        var command = new UpdateOfferDraftCommand(
            OfferId: offerId,
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
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

        var command = new UpdateOfferDraftCommand(
            OfferId: offerId,
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
            ConcurrencyToken: null,
            CurrentUserId: clientUserId,
            IsClientCompanyUser: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Bạn không có quyền chỉnh sửa offer của doanh nghiệp khác*");
    }

    [Fact]
    public async Task Handle_WhenOfferStatusIsNotDraft_ShouldThrowBadRequestException()
    {
        var offerId = Guid.NewGuid();
        var offer = new Offer
        {
            OfferId = offerId,
            Status = "SENT" // Not DRAFT
        };

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithApplicationAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var command = new UpdateOfferDraftCommand(
            OfferId: offerId,
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
            ConcurrencyToken: null,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Chỉ có thể chỉnh sửa offer khi đang ở trạng thái DRAFT*");
    }

    [Fact]
    public async Task Handle_WhenSuccessful_ShouldUpdateDraftOfferFields_AndSave()
    {
        var offerId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var offer = new Offer
        {
            OfferId = offerId,
            ApplicationId = Guid.NewGuid(),
            OfferVersion = 1,
            Salary = 15000000,
            CurrencyCode = "VND",
            Status = "DRAFT",
            StartDate = today.AddDays(15),
            ExpiryDate = today.AddDays(5),
            OfferDocumentUrl = "https://old-doc.pdf",
            ConcurrencyToken = Guid.NewGuid(),
            Application = new HRConnect.Domain.Entities.Application
            {
                Job = new Job { CompanyId = companyId }
            }
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

        var newStartDate = today.AddDays(30);
        var newExpiryDate = today.AddDays(10);
        var command = new UpdateOfferDraftCommand(
            OfferId: offerId,
            Salary: 28000000,
            CurrencyCode: "usd",
            StartDate: newStartDate,
            ExpiryDate: newExpiryDate,
            OfferDocumentUrl: "https://new-doc.pdf",
            ConcurrencyToken: offer.ConcurrencyToken,
            CurrentUserId: clientUserId,
            IsClientCompanyUser: true);

        var result = await CreateHandler().Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.OfferId.Should().Be(offerId);
        result.Salary.Should().Be(28000000);
        result.CurrencyCode.Should().Be("USD");
        result.StartDate.Should().Be(newStartDate);
        result.ExpiryDate.Should().Be(newExpiryDate);
        result.OfferDocumentUrl.Should().Be("https://new-doc.pdf");

        offer.Salary.Should().Be(28000000);
        offer.CurrencyCode.Should().Be("USD");
        offer.StartDate.Should().Be(newStartDate);
        offer.ExpiryDate.Should().Be(newExpiryDate);
        offer.OfferDocumentUrl.Should().Be("https://new-doc.pdf");

        _offerRepositoryMock.Verify(r => r.Update(offer), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
