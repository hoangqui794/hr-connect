using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateProfile;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public class GetAffiliateProfileQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepositoryMock;
    private readonly Mock<ILogger<GetAffiliateProfileQueryHandler>> _loggerMock;
    private readonly GetAffiliateProfileQueryHandler _handler;

    public GetAffiliateProfileQueryHandlerTests()
    {
        _affiliateProfileRepositoryMock = new Mock<IAffiliateProfileRepository>();
        _loggerMock = new Mock<ILogger<GetAffiliateProfileQueryHandler>>();
        _handler = new GetAffiliateProfileQueryHandler(_affiliateProfileRepositoryMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenAffiliateExists_ShouldReturnProfileResponse()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profile = new AffiliateProfile
        {
            AffiliateId = Guid.NewGuid(),
            UserId = userId,
            AffiliateType = "RECRUITER",
            DisplayName = "Cong Ty TNHH Tuyen Dung ABC",
            TaxInformation = "0123456789",
            ContactPerson = "Nguyen Van A",
            Phone = "0987654321",
            Address = "123 Le Loi, Quan 1, TP.HCM",
            Status = "ACTIVE",
            VerifiedAt = DateTime.UtcNow.AddDays(-10),
            CreatedAt = DateTime.UtcNow.AddDays(-10),
            UpdatedAt = DateTime.UtcNow,
            User = new AppUser
            {
                UserId = userId,
                Email = "affiliate@example.com",
                AvatarUrl = "https://example.com/avatar.png"
            }
        };

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var query = new GetAffiliateProfileQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Lấy thông tin hồ sơ đối tác tuyển dụng thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.AffiliateId.Should().Be(profile.AffiliateId);
        result.Data.UserId.Should().Be(userId);
        result.Data.Email.Should().Be("affiliate@example.com");
        result.Data.AvatarUrl.Should().Be("https://example.com/avatar.png");
        result.Data.DisplayName.Should().Be("Cong Ty TNHH Tuyen Dung ABC");
        result.Data.AffiliateType.Should().Be("RECRUITER");
        result.Data.TaxInformation.Should().Be("0123456789");
        result.Data.ContactPerson.Should().Be("Nguyen Van A");
        result.Data.Phone.Should().Be("0987654321");
        result.Data.Address.Should().Be("123 Le Loi, Quan 1, TP.HCM");
        result.Data.Status.Should().Be("ACTIVE");
        result.Data.VerifiedAt.Should().Be(profile.VerifiedAt);

        _affiliateProfileRepositoryMock.Verify(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAffiliateDoesNotExist_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var query = new GetAffiliateProfileQuery(userId);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy hồ sơ đối tác tuyển dụng*");

        _affiliateProfileRepositoryMock.Verify(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }
}
