using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.ResendPasswordResetOtp;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.ResendPasswordResetOtp;

public class ResendPasswordResetOtpCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IUserTokenRepository> _userTokenRepositoryMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<ResendPasswordResetOtpCommandHandler>> _loggerMock;
    private readonly IOptions<AuthenticationSettings> _authOptions;

    private readonly ResendPasswordResetOtpCommandHandler _handler;

    public ResendPasswordResetOtpCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _userTokenRepositoryMock = new Mock<IUserTokenRepository>();
        _emailServiceMock = new Mock<IEmailService>();
        _otpServiceMock = new Mock<IOtpService>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<ResendPasswordResetOtpCommandHandler>>();

        _authOptions = Options.Create(new AuthenticationSettings
        {
            Otp = new OtpSettings
            {
                Length = 6,
                ExpirationMinutes = 15
            }
        });

        _emailNormalizerMock
            .Setup(x => x.Normalize(It.IsAny<string>()))
            .Returns<string>(e => e.Trim().ToLowerInvariant());

        _handler = new ResendPasswordResetOtpCommandHandler(
            _userRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _emailServiceMock.Object,
            _otpServiceMock.Object,
            _emailNormalizerMock.Object,
            _unitOfWorkMock.Object,
            _authOptions,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnGenericSuccess_WhenEmailDoesNotExist()
    {
        // Arrange
        var command = new ResendPasswordResetOtpCommand("nonexistent@example.com");
        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("nonexistent@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("If the email is registered, a new password reset code has been sent.");

        // Must not create tokens or send email
        _userTokenRepositoryMock.Verify(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()), Times.Never);
        _emailServiceMock.Verify(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldReturnGenericSuccessWithoutEmail_WhenUserIsGoogleOnly()
    {
        // Arrange
        var command = new ResendPasswordResetOtpCommand("google@example.com");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "google@example.com",
            PasswordHash = "GOOGLE_OAUTH",
            Status = "ACTIVE"
        };

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("google@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Be("If the email is registered, a new password reset code has been sent.");
        _userTokenRepositoryMock.Verify(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldSkipGeneratingNewOtp_WhenWithinCooldownPeriod()
    {
        // Arrange
        var command = new ResendPasswordResetOtpCommand("cooldown@example.com");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "cooldown@example.com",
            PasswordHash = "$2a$12$somehash1234567890",
            Status = "ACTIVE"
        };

        var recentToken = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenType = "PASSWORD_RESET",
            TokenHash = "hash123",
            CreatedAt = DateTime.UtcNow.AddSeconds(-20), // Only 20s ago (cooldown is 60s)
            ExpiresAt = DateTime.UtcNow.AddMinutes(15)
        };

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("cooldown@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _userTokenRepositoryMock
            .Setup(x => x.GetLatestActiveOtpAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()))
            .ReturnsAsync(recentToken);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Be("If the email is registered, a new password reset code has been sent.");

        // Should NOT create new token or invalidate during cooldown
        _userTokenRepositoryMock.Verify(x => x.InvalidateActiveTokensAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _userTokenRepositoryMock.Verify(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldInvalidateOldOtpAndGenerateNewOne_WhenAfterCooldown()
    {
        // Arrange
        var command = new ResendPasswordResetOtpCommand("valid@example.com");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "valid@example.com",
            DisplayName = "Valid User",
            PasswordHash = "$2a$12$somevalidhashhere12345",
            Status = "ACTIVE"
        };

        var oldToken = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenType = "PASSWORD_RESET",
            TokenHash = "oldhash",
            CreatedAt = DateTime.UtcNow.AddSeconds(-70), // 70s ago (> 60s cooldown)
            ExpiresAt = DateTime.UtcNow.AddMinutes(14)
        };

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("valid@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _userTokenRepositoryMock
            .Setup(x => x.GetLatestActiveOtpAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()))
            .ReturnsAsync(oldToken);

        _otpServiceMock
            .Setup(x => x.GenerateNumericOtp(6))
            .Returns("654321");

        _otpServiceMock
            .Setup(x => x.HashOtp("654321"))
            .Returns("new_hash_654321");

        UserToken? newToken = null;
        _userTokenRepositoryMock
            .Setup(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()))
            .Callback<UserToken, CancellationToken>((t, _) => newToken = t)
            .Returns(Task.CompletedTask);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Be("If the email is registered, a new password reset code has been sent.");

        // Old token invalidated
        _userTokenRepositoryMock.Verify(x => x.InvalidateActiveTokensAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()), Times.Once);

        // New token saved
        newToken.Should().NotBeNull();
        newToken!.UserId.Should().Be(user.UserId);
        newToken.TokenType.Should().Be("PASSWORD_RESET");
        newToken.TokenHash.Should().Be("new_hash_654321");
        newToken.UsedAt.Should().BeNull();

        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
