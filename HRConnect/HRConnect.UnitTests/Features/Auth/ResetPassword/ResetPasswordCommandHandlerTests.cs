using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Auth.Commands.ResetPassword;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.ResetPassword;

public class ResetPasswordCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IUserTokenRepository> _userTokenRepositoryMock;
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepositoryMock;
    private readonly Mock<IPasswordHasher> _passwordHasherMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<ResetPasswordCommandHandler>> _loggerMock;

    private readonly ResetPasswordCommandHandler _handler;

    public ResetPasswordCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _userTokenRepositoryMock = new Mock<IUserTokenRepository>();
        _refreshTokenRepositoryMock = new Mock<IRefreshTokenRepository>();
        _passwordHasherMock = new Mock<IPasswordHasher>();
        _otpServiceMock = new Mock<IOtpService>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<ResetPasswordCommandHandler>>();

        _emailNormalizerMock
            .Setup(x => x.Normalize(It.IsAny<string>()))
            .Returns<string>(e => e.Trim().ToLowerInvariant());

        _handler = new ResetPasswordCommandHandler(
            _userRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _refreshTokenRepositoryMock.Object,
            _passwordHasherMock.Object,
            _otpServiceMock.Object,
            _emailNormalizerMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequest_WhenUserDoesNotExist()
    {
        // Arrange
        var command = new ResetPasswordCommand("unknown@example.com", "123456", "NewPass@123");
        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("unknown@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Mã xác thực đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequest_WhenNoActiveResetTokenFound()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = "hashed_old_password",
            Status = "ACTIVE"
        };
        var command = new ResetPasswordCommand("user@example.com", "123456", "NewPass@123");

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _userTokenRepositoryMock
            .Setup(x => x.GetLatestActiveOtpAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserToken?)null);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Mã xác thực đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequest_WhenOtpIsExpired()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = "hashed_old_password",
            Status = "ACTIVE"
        };
        var expiredToken = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenType = "PASSWORD_RESET",
            TokenHash = "hash123",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5), // Expired 5 mins ago
            AttemptCount = 0
        };
        var command = new ResetPasswordCommand("user@example.com", "123456", "NewPass@123");

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _userTokenRepositoryMock
            .Setup(x => x.GetLatestActiveOtpAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expiredToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Mã xác thực đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestAndIncrementAttemptCount_WhenOtpIsInvalid()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = "hashed_old_password",
            Status = "ACTIVE"
        };
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenType = "PASSWORD_RESET",
            TokenHash = "hash_correct",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            AttemptCount = 1
        };
        var command = new ResetPasswordCommand("user@example.com", "999999", "NewPass@123");

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _userTokenRepositoryMock
            .Setup(x => x.GetLatestActiveOtpAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);

        _otpServiceMock
            .Setup(x => x.VerifyOtp("999999", "hash_correct"))
            .Returns(false);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Mã xác thực đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");

        token.AttemptCount.Should().Be(2);
        _userTokenRepositoryMock.Verify(x => x.Update(token), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequest_WhenNewPasswordIsSameAsCurrent()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = "current_hash",
            Status = "ACTIVE"
        };
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenType = "PASSWORD_RESET",
            TokenHash = "hash_correct",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            AttemptCount = 0
        };
        var command = new ResetPasswordCommand("user@example.com", "123456", "SamePassword@123");

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _userTokenRepositoryMock
            .Setup(x => x.GetLatestActiveOtpAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);

        _otpServiceMock
            .Setup(x => x.VerifyOtp("123456", "hash_correct"))
            .Returns(true);

        _passwordHasherMock
            .Setup(x => x.Verify("SamePassword@123", "current_hash"))
            .Returns(true); // Same password!

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
    }

    [Fact]
    public async Task Handle_ShouldResetPasswordTransactionallyAndRevokeSessions_WhenOtpValid()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = "old_password_hash",
            Status = "ACTIVE"
        };
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenType = "PASSWORD_RESET",
            TokenHash = "valid_hash",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            AttemptCount = 0
        };
        var command = new ResetPasswordCommand("user@example.com", "123456", "BrandNewPassword@123");

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _userTokenRepositoryMock
            .Setup(x => x.GetLatestActiveOtpAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);

        _otpServiceMock
            .Setup(x => x.VerifyOtp("123456", "valid_hash"))
            .Returns(true);

        _passwordHasherMock
            .Setup(x => x.Verify("BrandNewPassword@123", "old_password_hash"))
            .Returns(false); // Different password

        _passwordHasherMock
            .Setup(x => x.Hash("BrandNewPassword@123"))
            .Returns("newly_hashed_password_abc");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Password has been reset successfully.");

        // User password updated
        user.PasswordHash.Should().Be("newly_hashed_password_abc");
        _userRepositoryMock.Verify(x => x.Update(user), Times.Once);

        // Token marked as used
        token.UsedAt.Should().NotBeNull();
        _userTokenRepositoryMock.Verify(x => x.Update(token), Times.Once);

        // Active tokens invalidated
        _userTokenRepositoryMock.Verify(x => x.InvalidateActiveTokensAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()), Times.Once);

        // All refresh tokens revoked
        _refreshTokenRepositoryMock.Verify(x => x.RevokeAllByUserIdAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()), Times.Once);

        // Transaction lifecycle verified
        _unitOfWorkMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
