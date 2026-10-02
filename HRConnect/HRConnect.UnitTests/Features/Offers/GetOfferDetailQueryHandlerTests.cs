using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Offers.Queries.GetOfferDetail;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Offers;

public class GetOfferDetailQueryHandlerTests
{
    private readonly Mock<IOfferRepository> _offerRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetOfferDetailQueryHandler>> _loggerMock = new();

    private GetOfferDetailQueryHandler CreateHandler() =>
        new(_offerRepositoryMock.Object, _companyUserRepositoryMock.Object, _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenOfferNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var offerId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Offer?)null);

        var query = new GetOfferDetailQuery(offerId, userId, IsInternalHrOrAdmin: true);

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy lời mời nhận việc*");
    }

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_AndDifferentCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var offerId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var userCompanyId = Guid.NewGuid();
        var offerCompanyId = Guid.NewGuid();

        var offer = CreateSampleOffer(offerId, offerCompanyId, Guid.NewGuid(), "SENT");

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = userCompanyId });

        var query = new GetOfferDetailQuery(offerId, userId, IsClientCompanyUser: true);

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*doanh nghiệp khác*");
    }

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_AndSameCompany_ShouldReturnOfferDetail()
    {
        // Arrange
        var offerId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var offer = CreateSampleOffer(offerId, companyId, Guid.NewGuid(), "DRAFT");

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });

        var query = new GetOfferDetailQuery(offerId, userId, IsClientCompanyUser: true);

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.OfferId.Should().Be(offerId);
        result.Data.Job.CompanyId.Should().Be(companyId);
    }

    [Fact]
    public async Task Handle_WhenUserIsCandidate_AndOwnOfferSent_ShouldReturnOfferDetail()
    {
        // Arrange
        var offerId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var offer = CreateSampleOffer(offerId, companyId, candidateUserId, "SENT");

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var query = new GetOfferDetailQuery(offerId, candidateUserId, IsCandidate: true);

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.OfferId.Should().Be(offerId);
        result.Data.Status.Should().Be("SENT");
    }

    [Fact]
    public async Task Handle_WhenUserIsCandidate_AndDifferentCandidate_ShouldThrowForbiddenException()
    {
        // Arrange
        var offerId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var offer = CreateSampleOffer(offerId, companyId, otherUserId, "SENT");

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var query = new GetOfferDetailQuery(offerId, candidateUserId, IsCandidate: true);

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*ứng viên khác*");
    }

    [Fact]
    public async Task Handle_WhenUserIsCandidate_AndOfferIsDraft_ShouldThrowForbiddenException()
    {
        // Arrange
        var offerId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var offer = CreateSampleOffer(offerId, companyId, candidateUserId, "DRAFT");

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var query = new GetOfferDetailQuery(offerId, candidateUserId, IsCandidate: true);

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*chưa được gửi tới bạn*");
    }

    [Fact]
    public async Task Handle_WhenUserIsInternalHrOrAdmin_ShouldReturnOfferDetailRegardlessOfStatus()
    {
        // Arrange
        var offerId = Guid.NewGuid();
        var adminUserId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();

        var offer = CreateSampleOffer(offerId, companyId, candidateUserId, "DRAFT");

        _offerRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(offerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var query = new GetOfferDetailQuery(offerId, adminUserId, IsInternalHrOrAdmin: true);

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.OfferId.Should().Be(offerId);
        result.Data.Status.Should().Be("DRAFT");
    }

    private static Offer CreateSampleOffer(Guid offerId, Guid companyId, Guid candidateUserId, string status)
    {
        var candidateId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();

        return new Offer
        {
            OfferId = offerId,
            ApplicationId = applicationId,
            OfferVersion = 1,
            Salary = 35000000m,
            CurrencyCode = "VND",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14)),
            ExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            Status = status,
            SentAt = status == "SENT" ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            ConcurrencyToken = Guid.NewGuid(),
            Application = new HRConnect.Domain.Entities.Application
            {
                ApplicationId = applicationId,
                JobId = jobId,
                CandidateId = candidateId,
                Job = new Job
                {
                    JobId = jobId,
                    CompanyId = companyId,
                    Title = "Lead Architect",
                    Company = new Company
                    {
                        CompanyId = companyId,
                        CompanyName = "Innovate Corp"
                    }
                },
                Candidate = new Candidate
                {
                    CandidateId = candidateId,
                    UserId = candidateUserId,
                    FullName = "Trần Thị C",
                    Email = "tranthic@example.com",
                    Phone = "0912345678"
                }
            },
            OfferApprovals = new List<OfferApproval>
            {
                new()
                {
                    ApprovalId = Guid.NewGuid(),
                    UserId = Guid.NewGuid(),
                    Status = "APPROVED",
                    Comment = "Approved salary package",
                    CreatedAt = DateTime.UtcNow,
                    User = new AppUser
                    {
                        UserId = Guid.NewGuid(),
                        DisplayName = "HR Manager"
                    }
                }
            },
            Placements = new List<Placement>()
        };
    }
}
