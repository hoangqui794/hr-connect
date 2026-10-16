using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;
using HRConnect.Application.Features.Reports.Common;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public class GetAffiliatePerformanceQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepositoryMock;
    private readonly Mock<IAffiliatePerformanceRepository> _performanceRepositoryMock;
    private readonly Mock<IAffiliatePerformanceCalculationService> _calculationServiceMock;
    private readonly Mock<ILogger<GetAffiliatePerformanceQueryHandler>> _loggerMock;
    private readonly GetAffiliatePerformanceQueryHandler _handler;

    public GetAffiliatePerformanceQueryHandlerTests()
    {
        _affiliateProfileRepositoryMock = new Mock<IAffiliateProfileRepository>();
        _performanceRepositoryMock = new Mock<IAffiliatePerformanceRepository>();
        _calculationServiceMock = new Mock<IAffiliatePerformanceCalculationService>();
        _loggerMock = new Mock<ILogger<GetAffiliatePerformanceQueryHandler>>();

        _handler = new GetAffiliatePerformanceQueryHandler(
            _affiliateProfileRepositoryMock.Object,
            _performanceRepositoryMock.Object,
            _calculationServiceMock.Object,
            _loggerMock.Object);
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
            SubmissionToHireRate = 0.2000m,
            QualityRating = 4.8500m,
            RatingLabel = "EXCELLENT",
            CalculationVersion = "v1",
            CalculatedAt = DateTime.UtcNow
        };

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _performanceRepositoryMock
            .Setup(r => r.GetByPeriodAsync(affiliateId, It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(performance);

        _performanceRepositoryMock
            .Setup(r => r.GetHistoryAsync(affiliateId, It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<AffiliatePerformance> { performance });

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
        result.Data.TotalSubmissions.Should().Be(25);
        result.Data.TotalShortlisted.Should().Be(15);
        result.Data.TotalInterviews.Should().Be(10);
        result.Data.TotalPlacements.Should().Be(5);
        result.Data.SubmissionToHireRate.Should().Be(0.2000m);
        result.Data.QualityRating.Should().Be(4.8500m);
        result.Data.RatingLabel.Should().Be("EXCELLENT");
        result.Data.CalculationVersion.Should().Be("v1");
        result.Data.History.Should().HaveCount(1);

        _affiliateProfileRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAffiliateExistsWithoutPerformanceSnapshot_CalculatesOnTheFly()
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

        var calculated = new AffiliatePerformance
        {
            AffiliatePerformanceId = Guid.NewGuid(),
            AffiliateId = affiliateId,
            PeriodStart = new DateOnly(2026, 10, 1),
            PeriodEnd = new DateOnly(2026, 10, 31),
            TotalSubmissions = 0,
            TotalShortlisted = 0,
            TotalInterviews = 0,
            TotalPlacements = 0,
            SubmissionToHireRate = null,
            QualityRating = null,
            RatingLabel = "NEW",
            CalculationVersion = "v1",
            CalculatedAt = DateTime.UtcNow
        };

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _performanceRepositoryMock
            .Setup(r => r.GetByPeriodAsync(affiliateId, It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliatePerformance?)null);

        _calculationServiceMock
            .Setup(c => c.CalculateAndUpsertAsync(affiliateId, It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(calculated);

        _performanceRepositoryMock
            .Setup(r => r.GetHistoryAsync(affiliateId, It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<AffiliatePerformance>());

        var query = new GetAffiliatePerformanceQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.AffiliateId.Should().Be(affiliateId);
        result.Data.TotalSubmissions.Should().Be(0);
        result.Data.RatingLabel.Should().Be("NEW");
        result.Data.QualityRating.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WhenAffiliateNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var query = new GetAffiliatePerformanceQuery(userId);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(query, CancellationToken.None));
    }
}
