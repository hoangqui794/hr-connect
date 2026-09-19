using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateBankAccount;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public class GetAffiliateBankAccountQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepositoryMock;
    private readonly Mock<ILogger<GetAffiliateBankAccountQueryHandler>> _loggerMock;
    private readonly GetAffiliateBankAccountQueryHandler _handler;

    public GetAffiliateBankAccountQueryHandlerTests()
    {
        _affiliateProfileRepositoryMock = new Mock<IAffiliateProfileRepository>();
        _loggerMock = new Mock<ILogger<GetAffiliateBankAccountQueryHandler>>();
        _handler = new GetAffiliateBankAccountQueryHandler(_affiliateProfileRepositoryMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenAffiliateExistsWithBankAccount_ShouldReturnConfiguredData()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var profile = new AffiliateProfile
        {
            AffiliateId = affiliateId,
            UserId = userId,
            DisplayName = "Nguyen Van Affiliate",
            BankName = "Vietcombank",
            BankAccountNumber = "0123456789",
            BankAccountHolder = "NGUYEN VAN AFFILIATE",
            BankBranch = "Hoi So Chinh",
            UpdatedAt = DateTime.UtcNow
        };

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var query = new GetAffiliateBankAccountQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Lấy thông tin tài khoản ngân hàng thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.AffiliateId.Should().Be(affiliateId);
        result.Data.DisplayName.Should().Be("Nguyen Van Affiliate");
        result.Data.BankName.Should().Be("Vietcombank");
        result.Data.BankAccountNumber.Should().Be("0123456789");
        result.Data.BankAccountHolder.Should().Be("NGUYEN VAN AFFILIATE");
        result.Data.BankBranch.Should().Be("Hoi So Chinh");
        result.Data.IsConfigured.Should().BeTrue();

        _affiliateProfileRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAffiliateExistsWithoutBankAccount_ShouldReturnUnconfiguredData()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var profile = new AffiliateProfile
        {
            AffiliateId = affiliateId,
            UserId = userId,
            DisplayName = "Chua Co Ngan Hang",
            BankName = null,
            BankAccountNumber = null,
            BankAccountHolder = null,
            BankBranch = null,
            UpdatedAt = DateTime.UtcNow
        };

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var query = new GetAffiliateBankAccountQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.AffiliateId.Should().Be(affiliateId);
        result.Data.BankName.Should().BeNull();
        result.Data.BankAccountNumber.Should().BeNull();
        result.Data.BankAccountHolder.Should().BeNull();
        result.Data.BankBranch.Should().BeNull();
        result.Data.IsConfigured.Should().BeFalse();

        _affiliateProfileRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAffiliateProfileNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var query = new GetAffiliateBankAccountQuery(userId);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin đối tác tuyển dụng*");

        _affiliateProfileRepositoryMock.Verify(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }
}
