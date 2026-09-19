using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Companies.Queries.GetCompanyProfile;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Companies;

public class GetCompanyProfileQueryHandlerTests
{
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock;
    private readonly Mock<ILogger<GetCompanyProfileQueryHandler>> _loggerMock;
    private readonly GetCompanyProfileQueryHandler _handler;

    public GetCompanyProfileQueryHandlerTests()
    {
        _companyUserRepositoryMock = new Mock<ICompanyUserRepository>();
        _loggerMock = new Mock<ILogger<GetCompanyProfileQueryHandler>>();
        _handler = new GetCompanyProfileQueryHandler(_companyUserRepositoryMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenCompanyUserAndCompanyExist_ShouldReturnCompanyProfileData()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var verifiedAt = DateTime.UtcNow.AddDays(-30);
        var createdAt = DateTime.UtcNow.AddDays(-60);
        var updatedAt = DateTime.UtcNow;

        var company = new Company
        {
            CompanyId = companyId,
            CompanyName = "Tập đoàn Công nghệ FPT",
            TaxCode = "0101248141",
            Industry = "Công nghệ thông tin",
            CompanySize = "1000+ nhân sự",
            Website = "https://fpt.com.vn",
            Address = "Toà nhà FPT, Phố Duy Tân, Cầu Giấy, Hà Nội",
            Description = "Tập đoàn hàng đầu về công nghệ và chuyển đổi số tại Việt Nam.",
            VerificationStatus = "VERIFIED",
            VerifiedAt = verifiedAt,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt
        };

        var companyUser = new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(),
            CompanyId = companyId,
            UserId = userId,
            RoleInCompany = "HR_MANAGER",
            IsPrimaryContact = true,
            Status = "ACTIVE",
            Company = company
        };

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(companyUser);

        var query = new GetCompanyProfileQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Lấy thông tin hồ sơ doanh nghiệp thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.CompanyId.Should().Be(companyId);
        result.Data.CompanyName.Should().Be("Tập đoàn Công nghệ FPT");
        result.Data.TaxCode.Should().Be("0101248141");
        result.Data.Industry.Should().Be("Công nghệ thông tin");
        result.Data.CompanySize.Should().Be("1000+ nhân sự");
        result.Data.Website.Should().Be("https://fpt.com.vn");
        result.Data.Address.Should().Be("Toà nhà FPT, Phố Duy Tân, Cầu Giấy, Hà Nội");
        result.Data.Description.Should().Be("Tập đoàn hàng đầu về công nghệ và chuyển đổi số tại Việt Nam.");
        result.Data.VerificationStatus.Should().Be("VERIFIED");
        result.Data.VerifiedAt.Should().Be(verifiedAt);
        result.Data.RoleInCompany.Should().Be("HR_MANAGER");
        result.Data.IsPrimaryContact.Should().BeTrue();
        result.Data.CreatedAt.Should().Be(createdAt);
        result.Data.UpdatedAt.Should().Be(updatedAt);

        _companyUserRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCompanyUserNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var query = new GetCompanyProfileQuery(userId);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin công ty*");

        _companyUserRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCompanyUserHasNullCompany_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyUser = new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(),
            CompanyId = Guid.NewGuid(),
            UserId = userId,
            Company = null!
        };

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(companyUser);

        var query = new GetCompanyProfileQuery(userId);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin công ty*");

        _companyUserRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }
}
