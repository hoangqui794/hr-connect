using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.Approvals.GetAffiliateApplicationDetail;
using HRConnect.Application.Features.Admin.Approvals.GetCompanyVerificationDetail;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Admin.Approvals;

public class GetApplicationDetailQueryHandlerTests
{
    private readonly Mock<IAffiliateApplicationRepository> _affiliateRepoMock;
    private readonly Mock<ICompanyVerificationRequestRepository> _companyRepoMock;

    public GetApplicationDetailQueryHandlerTests()
    {
        _affiliateRepoMock = new Mock<IAffiliateApplicationRepository>();
        _companyRepoMock = new Mock<ICompanyVerificationRequestRepository>();
    }

    [Fact]
    public async Task GetAffiliateDetail_ShouldReturnDetail_WhenFound()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate@example.com",
            DisplayName = "Nguyen Van A",
            Phone = "0901234567"
        };
        var app = new AffiliateApplication
        {
            AffiliateApplicationId = appId,
            UserId = user.UserId,
            User = user,
            AffiliateType = "RECRUITER",
            Status = "UNDER_REVIEW",
            SubmittedData = "{}",
            SubmittedAt = DateTime.UtcNow
        };

        _affiliateRepoMock.Setup(r => r.GetByIdWithDetailsAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var handler = new GetAffiliateApplicationDetailQueryHandler(_affiliateRepoMock.Object);

        // Act
        var result = await handler.Handle(new GetAffiliateApplicationDetailQuery(appId), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data!.ApplicationId.Should().Be(appId);
        result.Data.Email.Should().Be("affiliate@example.com");
        result.Data.Status.Should().Be("UNDER_REVIEW");
    }

    [Fact]
    public async Task GetAffiliateDetail_ShouldThrowNotFound_WhenNotFound()
    {
        // Arrange
        var appId = Guid.NewGuid();
        _affiliateRepoMock.Setup(r => r.GetByIdWithDetailsAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateApplication?)null);

        var handler = new GetAffiliateApplicationDetailQueryHandler(_affiliateRepoMock.Object);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetAffiliateApplicationDetailQuery(appId), CancellationToken.None));
    }

    [Fact]
    public async Task GetCompanyDetail_ShouldReturnDetail_WhenFound()
    {
        // Arrange
        var reqId = Guid.NewGuid();
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "company@example.com",
            DisplayName = "Tran Thi B",
            Phone = "0987654321"
        };
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Enterprise Tech",
            TaxCode = "0123456789"
        };
        var req = new CompanyVerificationRequest
        {
            CompanyVerificationRequestId = reqId,
            CompanyId = company.CompanyId,
            Company = company,
            SubmittedBy = user.UserId,
            SubmittedByNavigation = user,
            Status = "UNDER_REVIEW",
            SubmittedPayload = "{}",
            SubmittedAt = DateTime.UtcNow
        };

        _companyRepoMock.Setup(r => r.GetByIdWithDetailsAsync(reqId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(req);

        var handler = new GetCompanyVerificationDetailQueryHandler(_companyRepoMock.Object);

        // Act
        var result = await handler.Handle(new GetCompanyVerificationDetailQuery(reqId), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data!.VerificationRequestId.Should().Be(reqId);
        result.Data.CompanyName.Should().Be("Enterprise Tech");
        result.Data.TaxCode.Should().Be("0123456789");
    }

    [Fact]
    public async Task GetCompanyDetail_ShouldThrowNotFound_WhenNotFound()
    {
        // Arrange
        var reqId = Guid.NewGuid();
        _companyRepoMock.Setup(r => r.GetByIdWithDetailsAsync(reqId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyVerificationRequest?)null);

        var handler = new GetCompanyVerificationDetailQueryHandler(_companyRepoMock.Object);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetCompanyVerificationDetailQuery(reqId), CancellationToken.None));
    }
}
