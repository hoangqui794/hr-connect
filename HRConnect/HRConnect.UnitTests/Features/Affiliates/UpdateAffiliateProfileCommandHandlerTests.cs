using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateProfile;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public class UpdateAffiliateProfileCommandHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepositoryMock;
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IPhoneNormalizer> _phoneNormalizerMock;
    private readonly Mock<ILogger<UpdateAffiliateProfileCommandHandler>> _loggerMock;
    private readonly UpdateAffiliateProfileCommandHandler _handler;

    public UpdateAffiliateProfileCommandHandlerTests()
    {
        _affiliateProfileRepositoryMock = new Mock<IAffiliateProfileRepository>();
        _userRepositoryMock = new Mock<IUserRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _phoneNormalizerMock = new Mock<IPhoneNormalizer>();
        _loggerMock = new Mock<ILogger<UpdateAffiliateProfileCommandHandler>>();

        _phoneNormalizerMock.Setup(p => p.Normalize(It.IsAny<string?>()))
            .Returns((string? phone) => phone?.Replace(" ", ""));

        _handler = new UpdateAffiliateProfileCommandHandler(
            _affiliateProfileRepositoryMock.Object,
            _userRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _phoneNormalizerMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenAffiliateExists_ShouldUpdateProfileAndSyncUser()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profile = new AffiliateProfile
        {
            AffiliateId = Guid.NewGuid(),
            UserId = userId,
            AffiliateType = "RECRUITER",
            DisplayName = "Old Name",
            ContactPerson = "Old Contact",
            Phone = "0901234567",
            Address = "Old Address",
            TaxInformation = "1111111111",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddMonths(-1),
            UpdatedAt = DateTime.UtcNow.AddMonths(-1)
        };

        var user = new AppUser
        {
            UserId = userId,
            DisplayName = "Old Name",
            Email = "affiliate@example.com",
            Phone = "0901234567"
        };

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new UpdateAffiliateProfileCommand
        {
            UserId = userId,
            DisplayName = "Công Ty ABC Tuyển Dụng",
            ContactPerson = "Trần Thị B",
            Phone = "0987 654 321",
            Address = "456 Nguyễn Huệ, Q1, TP.HCM",
            TaxInformation = "0987654321"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Cập nhật hồ sơ đối tác tuyển dụng thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.DisplayName.Should().Be("Công Ty ABC Tuyển Dụng");
        result.Data.ContactPerson.Should().Be("Trần Thị B");
        result.Data.Phone.Should().Be("0987 654 321");
        result.Data.Address.Should().Be("456 Nguyễn Huệ, Q1, TP.HCM");
        result.Data.TaxInformation.Should().Be("0987654321");

        // Verify entity updated
        profile.DisplayName.Should().Be("Công Ty ABC Tuyển Dụng");
        profile.ContactPerson.Should().Be("Trần Thị B");
        profile.Phone.Should().Be("0987 654 321");
        profile.Address.Should().Be("456 Nguyễn Huệ, Q1, TP.HCM");
        profile.TaxInformation.Should().Be("0987654321");

        // Verify user sync
        user.DisplayName.Should().Be("Công Ty ABC Tuyển Dụng");
        user.Phone.Should().Be("0987 654 321");
        user.NormalizedPhone.Should().Be("0987654321");

        _affiliateProfileRepositoryMock.Verify(r => r.Update(profile), Times.Once);
        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAffiliateDoesNotExist_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var command = new UpdateAffiliateProfileCommand
        {
            UserId = userId,
            DisplayName = "Test Name"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy hồ sơ đối tác tuyển dụng*");

        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
