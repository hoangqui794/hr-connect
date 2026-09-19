using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateBankAccount;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public class UpdateAffiliateBankAccountCommandHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<UpdateAffiliateBankAccountCommandHandler>> _loggerMock;
    private readonly UpdateAffiliateBankAccountCommandHandler _handler;

    public UpdateAffiliateBankAccountCommandHandlerTests()
    {
        _affiliateProfileRepositoryMock = new Mock<IAffiliateProfileRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<UpdateAffiliateBankAccountCommandHandler>>();

        _handler = new UpdateAffiliateBankAccountCommandHandler(
            _affiliateProfileRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenAffiliateExists_ShouldUpdateBankAccountSuccessfully()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var profile = new AffiliateProfile
        {
            AffiliateId = affiliateId,
            UserId = userId,
            DisplayName = "Nguyen Van B",
            BankName = "Agribank",
            BankAccountNumber = "111122223333",
            BankAccountHolder = "NGUYEN VAN B",
            BankBranch = null,
            UpdatedAt = DateTime.UtcNow.AddDays(-1)
        };

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var command = new UpdateAffiliateBankAccountCommand
        {
            UserId = userId,
            BankName = "Techcombank",
            BankAccountNumber = "9876543210",
            BankAccountHolder = "nguyen van b",
            BankBranch = "Chi nhanh Dong Da"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Cập nhật thông tin tài khoản ngân hàng nhận hoa hồng thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.AffiliateId.Should().Be(affiliateId);
        result.Data.BankName.Should().Be("Techcombank");
        result.Data.BankAccountNumber.Should().Be("9876543210");
        result.Data.BankAccountHolder.Should().Be("NGUYEN VAN B"); // Chuẩn hóa in hoa
        result.Data.BankBranch.Should().Be("Chi nhanh Dong Da");

        profile.BankName.Should().Be("Techcombank");
        profile.BankAccountNumber.Should().Be("9876543210");
        profile.BankAccountHolder.Should().Be("NGUYEN VAN B");
        profile.BankBranch.Should().Be("Chi nhanh Dong Da");

        _affiliateProfileRepositoryMock.Verify(r => r.Update(profile), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAffiliateNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _affiliateProfileRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var command = new UpdateAffiliateBankAccountCommand
        {
            UserId = userId,
            BankName = "Techcombank",
            BankAccountNumber = "9876543210",
            BankAccountHolder = "NGUYEN VAN B"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin đối tác tuyển dụng*");

        _affiliateProfileRepositoryMock.Verify(r => r.Update(It.IsAny<AffiliateProfile>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
