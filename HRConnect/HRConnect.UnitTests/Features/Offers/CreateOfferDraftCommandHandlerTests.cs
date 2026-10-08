using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Offers.Commands.CreateOfferDraft;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Offers;

public class CreateOfferDraftCommandHandlerTests
{
    private readonly Mock<IOfferRepository> _offerRepositoryMock = new();
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<CreateOfferDraftCommandHandler>> _loggerMock = new();
    private readonly Mock<IAuditLogService> _auditLogServiceMock = new();

    private CreateOfferDraftCommandHandler CreateHandler() =>
        new(
            _offerRepositoryMock.Object,
            _applicationRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object,
            _auditLogServiceMock.Object);

    [Fact]
    public async Task Handle_WhenSalaryIsNegative_ShouldThrowBadRequestException()
    {
        var command = new CreateOfferDraftCommand(
            ApplicationId: Guid.NewGuid(),
            Salary: -1000,
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
        var command = new CreateOfferDraftCommand(
            ApplicationId: Guid.NewGuid(),
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
        var startDate = today.AddDays(5);

        var command = new CreateOfferDraftCommand(
            ApplicationId: Guid.NewGuid(),
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
    public async Task Handle_WhenApplicationNotFound_ShouldThrowNotFoundException()
    {
        var appId = Guid.NewGuid();
        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((HRConnect.Domain.Entities.Application?)null);

        var command = new CreateOfferDraftCommand(
            ApplicationId: appId,
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
            .WithMessage("*Không tìm thấy hồ sơ ứng tuyển*");
    }

    [Fact]
    public async Task Handle_WhenConcurrencyTokenMismatch_ShouldThrowConflictException()
    {
        var appId = Guid.NewGuid();
        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_PENDING",
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var command = new CreateOfferDraftCommand(
            ApplicationId: appId,
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
            ConcurrencyToken: Guid.NewGuid(), // Mismatched token
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Dữ liệu hồ sơ đã bị thay đổi bởi người khác*");
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUserFromDifferentCompany_ShouldThrowForbiddenException()
    {
        var appId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var companyA = Guid.NewGuid();
        var companyB = Guid.NewGuid();

        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_PENDING",
            Job = new Job { CompanyId = companyA }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        _offerRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Offer>());

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = companyB });

        var command = new CreateOfferDraftCommand(
            ApplicationId: appId,
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
            ConcurrencyToken: app.ConcurrencyToken,
            CurrentUserId: clientUserId,
            IsClientCompanyUser: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Bạn không có quyền tạo offer cho ứng viên của doanh nghiệp khác*");
    }

    [Fact]
    public async Task Handle_WhenApplicationIsNotOfferPending_ShouldThrowBadRequestException()
    {
        var appId = Guid.NewGuid();
        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "REJECTED"
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var command = new CreateOfferDraftCommand(
            ApplicationId: appId,
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
            ConcurrencyToken: app.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Chỉ có thể tạo offer khi hồ sơ đang ở trạng thái OFFER_PENDING*");
    }

    [Fact]
    public async Task Handle_WhenExistingDraftOfferExists_ShouldThrowBadRequestException()
    {
        var appId = Guid.NewGuid();
        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_PENDING"
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var existingOffers = new List<Offer>
        {
            new Offer { OfferId = Guid.NewGuid(), ApplicationId = appId, OfferVersion = 1, Status = "DRAFT" }
        };

        _offerRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingOffers);

        var command = new CreateOfferDraftCommand(
            ApplicationId: appId,
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
            ConcurrencyToken: app.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Đã tồn tại một bản nháp offer chưa gửi*");
    }

    [Fact]
    public async Task Handle_WhenExistingSentOfferExists_ShouldThrowBadRequestException()
    {
        var appId = Guid.NewGuid();
        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_PENDING"
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var existingOffers = new List<Offer>
        {
            new Offer { OfferId = Guid.NewGuid(), ApplicationId = appId, OfferVersion = 1, Status = "SENT" }
        };

        _offerRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingOffers);

        var command = new CreateOfferDraftCommand(
            ApplicationId: appId,
            Salary: 10000000,
            CurrencyCode: "VND",
            StartDate: null,
            ExpiryDate: null,
            OfferDocumentUrl: null,
            ConcurrencyToken: app.ConcurrencyToken,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true);

        Func<Task> act = async () => await CreateHandler().Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Đang có một offer đã gửi chờ ứng viên phản hồi*");
    }

    [Fact]
    public async Task Handle_WhenSuccessful_ShouldCreateDraftOffer_WithNextVersion()
    {
        var appId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = appId,
            Status = "OFFER_PENDING",
            Job = new Job { CompanyId = companyId },
            ConcurrencyToken = Guid.NewGuid()
        };

        _applicationRepositoryMock
            .Setup(r => r.GetByIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = companyId });

        var existingOffers = new List<Offer>
        {
            new Offer { OfferId = Guid.NewGuid(), ApplicationId = appId, OfferVersion = 1, Status = "DECLINED" }
        };

        _offerRepositoryMock
            .Setup(r => r.GetByApplicationIdAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingOffers);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var command = new CreateOfferDraftCommand(
            ApplicationId: appId,
            Salary: 25000000,
            CurrencyCode: "vnd",
            StartDate: today.AddDays(20),
            ExpiryDate: today.AddDays(7),
            OfferDocumentUrl: "https://storage.hrconnect.vn/offers/doc1.pdf",
            ConcurrencyToken: app.ConcurrencyToken,
            CurrentUserId: clientUserId,
            IsClientCompanyUser: true);

        Offer? addedOffer = null;
        _offerRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Offer>(), It.IsAny<CancellationToken>()))
            .Callback<Offer, CancellationToken>((o, _) => addedOffer = o)
            .Returns(Task.CompletedTask);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var result = await CreateHandler().Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.OfferVersion.Should().Be(2); // previous was 1
        result.Salary.Should().Be(25000000);
        result.CurrencyCode.Should().Be("VND");
        result.Status.Should().Be("DRAFT");
        result.OfferDocumentUrl.Should().Be("https://storage.hrconnect.vn/offers/doc1.pdf");
        result.ApplicationStatus.Should().Be("OFFER_PENDING");

        addedOffer.Should().NotBeNull();
        addedOffer!.OfferVersion.Should().Be(2);
        addedOffer.Status.Should().Be("DRAFT");
        addedOffer.CreatedBy.Should().Be(clientUserId);

        app.Status.Should().Be("OFFER_PENDING");
        app.ApplicationStatusHistories.Should().BeEmpty();

        _offerRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Offer>(), It.IsAny<CancellationToken>()), Times.Once);
        _applicationRepositoryMock.Verify(r => r.Update(app), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
