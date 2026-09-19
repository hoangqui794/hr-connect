using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public class GetAffiliatePerformanceQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepositoryMock;
    private readonly Mock<ILogger<GetAffiliatePerformanceQueryHandler>> _loggerMock;
    private readonly GetAffiliatePerformanceQueryHandler _handler;

    public GetAffiliatePerformanceQueryHandlerTests()
    {
        _affiliateProfileRepositoryMock = new Mock<IAffiliateProfileRepository>();
        _loggerMock = new Mock<ILogger<GetAffiliatePerformanceQueryHandler>>();
        _handler = new GetAffiliatePerformanceQueryHandler(_affiliateProfileRepositoryMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenAffiliateExistsWithPerformanceSnapshot_ShouldReturnPerformanceData()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var profile = new AffiliateProfile
        {
            AffiliateId = affiliateId,
            UserId = userId,
            AffiliateType = "RECRUITER",
            DisplayName = "Đối Tác Tuyển Dụng Hàng Đầu",
            Status = "ACTIVE"
        };

        var performance = new AffiliatePerformance
        {
            AffiliatePerformanceId = Guid.NewGuid(),
            AffiliateId = affiliateId,
            PeriodStart = new DateOnly(2026, 9, 1),
            PeriodEnd = new DateOnly(2026, 9, 30),
            TotalSubmissions = 25,
            TotalShortlisted = 15,
            TotalInterviews = 10,
            TotalPlacements = 5,
            SubmissionToHireRate = 20.0000m,
            QualityRating = 4.8500m,
            RatingLabel = "EXCELLENT",
            CalculationVersion = "D17-V1.0",
            CalculatedAt = DateTime.UtcNow
        };

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetLatestPerformanceByAffiliateIdAsync(affiliateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(performance);

        var query = new GetAffiliatePerformanceQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Lấy thống kê hiệu suất đối tác tuyển dụng thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.AffiliateId.Should().Be(affiliateId);
        result.Data.DisplayName.Should().Be("Đối Tác Tuyển Dụng Hàng Đầu");
        result.Data.AffiliateType.Should().Be("RECRUITER");
        result.Data.Status.Should().Be("ACTIVE");
        result.Data.PeriodStart.Should().Be(new DateOnly(2026, 9, 1));
        result.Data.PeriodEnd.Should().Be(new DateOnly(2026, 9, 30));
        result.Data.TotalSubmissions.Should().Be(25);
        result.Data.TotalShortlisted.Should().Be(15);
        result.Data.TotalInterviews.Should().Be(10);
        result.Data.TotalPlacements.Should().Be(5);
        result.Data.SubmissionToHireRate.Should().Be(20.0000m);
        result.Data.QualityRating.Should().Be(4.8500m);
        result.Data.RatingLabel.Should().Be("EXCELLENT");
        result.Data.CalculationVersion.Should().Be("D17-V1.0");

        _affiliateProfileRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
        _affiliateProfileRepositoryMock.Verify(r => r.GetLatestPerformanceByAffiliateIdAsync(affiliateId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAffiliateExistsWithoutPerformanceSnapshot_ShouldReturnDefaultZeroValues()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var profile = new AffiliateProfile
        {
            AffiliateId = affiliateId,
            UserId = userId,
            AffiliateType = "INDIVIDUAL",
            DisplayName = "Nguyen Van Affiliate",
            Status = "ACTIVE"
        };

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetLatestPerformanceByAffiliateIdAsync(affiliateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliatePerformance?)null);

        var query = new GetAffiliatePerformanceQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Lấy thống kê hiệu suất đối tác tuyển dụng thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.AffiliateId.Should().Be(affiliateId);
        result.Data.DisplayName.Should().Be("Nguyen Van Affiliate");
        result.Data.AffiliateType.Should().Be("INDIVIDUAL");
        result.Data.Status.Should().Be("ACTIVE");
        result.Data.PeriodStart.Should().BeNull();
        result.Data.PeriodEnd.Should().BeNull();
        result.Data.TotalSubmissions.Should().Be(0);
        result.Data.TotalShortlisted.Should().Be(0);
        result.Data.TotalInterviews.Should().Be(0);
        result.Data.TotalPlacements.Should().Be(0);
        result.Data.SubmissionToHireRate.Should().Be(0m);
        result.Data.QualityRating.Should().BeNull();
        result.Data.RatingLabel.Should().Be("NEW");
        result.Data.CalculatedAt.Should().BeNull();

        _affiliateProfileRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
        _affiliateProfileRepositoryMock.Verify(r => r.GetLatestPerformanceByAffiliateIdAsync(affiliateId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAffiliateProfileNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var query = new GetAffiliatePerformanceQuery(userId);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin đối tác tuyển dụng*");

        _affiliateProfileRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
        _affiliateProfileRepositoryMock.Verify(r => r.GetLatestPerformanceByAffiliateIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
