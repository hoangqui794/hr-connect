using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.ForgotPassword;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.ForgotPassword;

public class ForgotPasswordCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IUserTokenRepository> _userTokenRepositoryMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<ForgotPasswordCommandHandler>> _loggerMock;
    private readonly IOptions<AuthenticationSettings> _authOptions;

    private readonly ForgotPasswordCommandHandler _handler;

    public ForgotPasswordCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _userTokenRepositoryMock = new Mock<IUserTokenRepository>();
        _emailServiceMock = new Mock<IEmailService>();
        _otpServiceMock = new Mock<IOtpService>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<ForgotPasswordCommandHandler>>();

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

        _handler = new ForgotPasswordCommandHandler(
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
        var command = new ForgotPasswordCommand("nonexistent@example.com");
        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("nonexistent@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("If the email is registered, a password reset code has been sent.");

        // Must not create tokens or send emails
        _userTokenRepositoryMock.Verify(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()), Times.Never);
        _emailServiceMock.Verify(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldReturnGenericSuccessWithoutEmail_WhenUserIsGoogleOnly()
    {
        // Arrange
        var command = new ForgotPasswordCommand("googleuser@example.com");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "googleuser@example.com",
            PasswordHash = "GOOGLE_OAUTH_NO_LOCAL_PASSWORD",
            Status = "ACTIVE"
        };

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("googleuser@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Be("If the email is registered, a password reset code has been sent.");

        // Must not create reset token
        _userTokenRepositoryMock.Verify(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldReturnGenericSuccessWithoutEmail_WhenUserIsBlocked()
    {
        // Arrange
        var command = new ForgotPasswordCommand("blocked@example.com");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "blocked@example.com",
            PasswordHash = "$2a$12$somehashedpasswordhere123456",
            Status = "BLOCKED"
        };

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("blocked@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        _userTokenRepositoryMock.Verify(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldGenerateOtpSaveTokenAndInvalidatePrevious_WhenUserExistsAndEligible()
    {
        // Arrange
        var command = new ForgotPasswordCommand("validuser@example.com");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "validuser@example.com",
            DisplayName = "Valid User",
            PasswordHash = "$2a$12$somevalidbcryptpasswordsample123",
            Status = "ACTIVE"
        };

        _userRepositoryMock
            .Setup(x => x.GetByEmailAsync("validuser@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _otpServiceMock
            .Setup(x => x.GenerateNumericOtp(6))
            .Returns("123456");

        _otpServiceMock
            .Setup(x => x.HashOtp("123456"))
            .Returns("hashed_otp_123456");

        UserToken? capturedToken = null;
        _userTokenRepositoryMock
            .Setup(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()))
            .Callback<UserToken, CancellationToken>((t, _) => capturedToken = t)
            .Returns(Task.CompletedTask);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("If the email is registered, a password reset code has been sent.");

        // Verify invalidation of previous PASSWORD_RESET tokens
        _userTokenRepositoryMock.Verify(x => x.InvalidateActiveTokensAsync(user.UserId, "PASSWORD_RESET", It.IsAny<CancellationToken>()), Times.Once);

        // Verify token saved
        capturedToken.Should().NotBeNull();
        capturedToken!.UserId.Should().Be(user.UserId);
        capturedToken.TokenType.Should().Be("PASSWORD_RESET");
        capturedToken.TokenHash.Should().Be("hashed_otp_123456");
        capturedToken.UsedAt.Should().BeNull();
        capturedToken.AttemptCount.Should().Be(0);
        capturedToken.ExpiresAt.Should().BeAfter(DateTime.UtcNow);

        // Verify unit of work commit
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
