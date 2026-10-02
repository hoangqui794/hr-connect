using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Offers.Queries.GetOffers;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Offers;

public class GetOffersQueryHandlerTests
{
    private readonly Mock<IOfferRepository> _offerRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetOffersQueryHandler>> _loggerMock = new();

    private GetOffersQueryHandler CreateHandler() =>
        new(_offerRepositoryMock.Object, _companyUserRepositoryMock.Object, _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_ShouldFilterByCompanyId()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var offer = CreateSampleOffer(companyId, "SENT");

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });

        _offerRepositoryMock
            .Setup(r => r.GetOffersAsync(
                companyId,
                null,
                null,
                null,
                null,
                null,
                false,
                1,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([offer], 1));

        var query = new GetOffersQuery(
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Items.Should().HaveCount(1);
        result.Data.Items[0].CompanyId.Should().Be(companyId);
        result.Data.Total.Should().Be(1);
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUserHasNoCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var query = new GetOffersQuery(
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không thuộc doanh nghiệp nào*");
    }

    [Fact]
    public async Task Handle_WhenUserIsCandidate_ShouldFilterByCandidateUserIdAndHideDrafts()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var offer = CreateSampleOffer(companyId, "SENT");

        _offerRepositoryMock
            .Setup(r => r.GetOffersAsync(
                null,
                userId,
                null,
                null,
                null,
                null,
                true,
                1,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([offer], 1));

        var query = new GetOffersQuery(
            CurrentUserId: userId,
            IsCandidate: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Items.Should().HaveCount(1);
        result.Data.Items[0].Status.Should().Be("SENT");
    }

    [Fact]
    public async Task Handle_WhenUserIsInternalHrOrAdmin_ShouldNotFilterByCompanyOrCandidate()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var offer = CreateSampleOffer(companyId, "DRAFT");

        _offerRepositoryMock
            .Setup(r => r.GetOffersAsync(
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                1,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([offer], 1));

        var query = new GetOffersQuery(
            CurrentUserId: userId,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Items.Should().HaveCount(1);
        result.Data.Items[0].Status.Should().Be("DRAFT");
    }

    [Fact]
    public async Task Handle_WhenUserHasNoValidRole_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var query = new GetOffersQuery(
            CurrentUserId: userId,
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false,
            IsCandidate: false
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không có quyền xem danh sách lời mời nhận việc*");
    }

    [Fact]
    public async Task Handle_WhenPaginationProvided_ShouldClampPageSizeAndCalculateTotalPages()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var offers = Enumerable.Range(1, 20)
            .Select(_ => CreateSampleOffer(companyId, "SENT"))
            .ToList();

        _offerRepositoryMock
            .Setup(r => r.GetOffersAsync(
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                2,
                15,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((offers.Take(15).ToList(), 35));

        var query = new GetOffersQuery(
            CurrentUserId: userId,
            IsInternalHrOrAdmin: true,
            Page: 2,
            PageSize: 15
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Data.Page.Should().Be(2);
        result.Data.PageSize.Should().Be(15);
        result.Data.Total.Should().Be(35);
        result.Data.TotalPages.Should().Be(3);
    }

    private static Offer CreateSampleOffer(Guid companyId, string status)
    {
        var candidateId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();

        return new Offer
        {
            OfferId = Guid.NewGuid(),
            ApplicationId = applicationId,
            OfferVersion = 1,
            Salary = 30000000m,
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
                    Title = "Senior .NET Developer",
                    Company = new Company
                    {
                        CompanyId = companyId,
                        CompanyName = "TechCorp"
                    }
                },
                Candidate = new Candidate
                {
                    CandidateId = candidateId,
                    FullName = "Nguyễn Văn B",
                    Email = "nguyenvanb@example.com",
                    Phone = "0987654321"
                }
            }
        };
    }
}
