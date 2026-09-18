using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.VerifyEmailOtp;

public class VerifyEmailOtpCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IUserTokenRepository> _userTokenRepositoryMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<VerifyEmailOtpCommandHandler>> _loggerMock;

    private readonly VerifyEmailOtpCommandHandler _handler;

    public VerifyEmailOtpCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _userTokenRepositoryMock = new Mock<IUserTokenRepository>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _otpServiceMock = new Mock<IOtpService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<VerifyEmailOtpCommandHandler>>();

        _handler = new VerifyEmailOtpCommandHandler(
            _userRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _emailNormalizerMock.Object,
            _otpServiceMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenUserNotFound()
    {
        // Arrange
        var command = new VerifyEmailOtpCommand("notfound@example.com", "123456");
        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("notfound@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("notfound@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Không tìm thấy tài khoản*");
    }

    [Fact]
    public async Task Handle_ShouldReturnSuccess_WhenUserIsAlreadyActive()
    {
        // Arrange
        var command = new VerifyEmailOtpCommand("active@example.com", "123456");
        var activeUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "active@example.com",
            Status = "ACTIVE",
            EmailVerifiedAt = DateTime.UtcNow.AddDays(-1)
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("active@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("active@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(activeUser);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("đã được xác thực email từ trước");
        result.Data!.Status.Should().Be("ACTIVE");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenNoActiveTokenExists()
    {
        // Arrange
        var command = new VerifyEmailOtpCommand("pending@example.com", "123456");
        var pendingUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "pending@example.com",
            Status = "PENDING"
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("pending@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("pending@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(pendingUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserToken?)null);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Mã OTP không tồn tại hoặc đã được sử dụng*");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenAttemptCountExceedsMaxLimit()
    {
        // Arrange
        var command = new VerifyEmailOtpCommand("pending@example.com", "123456");
        var pendingUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "pending@example.com",
            Status = "PENDING"
        };
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = pendingUser.UserId,
            AttemptCount = 5, // Locked!
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("pending@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("pending@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(pendingUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*quá 5 lần*Mã xác thực này đã bị khóa*");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenOtpIsExpired()
    {
        // Arrange
        var command = new VerifyEmailOtpCommand("pending@example.com", "123456");
        var pendingUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "pending@example.com",
            Status = "PENDING"
        };
        var expiredToken = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = pendingUser.UserId,
            AttemptCount = 0,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5) // Expired 5 mins ago
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("pending@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("pending@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(pendingUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expiredToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Mã OTP đã hết hạn*");
    }

    [Fact]
    public async Task Handle_ShouldIncrementAttemptCountAndThrow_WhenOtpIsIncorrect()
    {
        // Arrange
        var command = new VerifyEmailOtpCommand("pending@example.com", "111111");
        var pendingUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "pending@example.com",
            Status = "PENDING"
        };
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = pendingUser.UserId,
            TokenHash = "valid_hash",
            AttemptCount = 1,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("pending@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("pending@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(pendingUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);
        _otpServiceMock.Setup(x => x.VerifyOtp("111111", "valid_hash")).Returns(false);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Mã OTP không chính xác*");

        token.AttemptCount.Should().Be(2);
        _userTokenRepositoryMock.Verify(x => x.Update(token), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldActivateUserAndMarkTokenUsed_WhenOtpIsCorrect()
    {
        // Arrange
        var command = new VerifyEmailOtpCommand("pending@example.com", "123456");
        var pendingUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "pending@example.com",
            Status = "PENDING",
            EmailVerifiedAt = null
        };
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = pendingUser.UserId,
            TokenHash = "valid_hash",
            AttemptCount = 0,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            UsedAt = null
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("pending@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("pending@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(pendingUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);
        _otpServiceMock.Setup(x => x.VerifyOtp("123456", "valid_hash")).Returns(true);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data!.Status.Should().Be("ACTIVE");
        result.Data.EmailVerifiedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));

        pendingUser.Status.Should().Be("ACTIVE");
        pendingUser.EmailVerifiedAt.Should().NotBeNull();
        token.UsedAt.Should().NotBeNull();

        _userRepositoryMock.Verify(x => x.Update(pendingUser), Times.Once);
        _userTokenRepositoryMock.Verify(x => x.Update(token), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
