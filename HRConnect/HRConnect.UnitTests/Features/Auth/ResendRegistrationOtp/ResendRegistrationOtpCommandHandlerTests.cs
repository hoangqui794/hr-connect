using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.ResendRegistrationOtp;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.ResendRegistrationOtp;

public class ResendRegistrationOtpCommandHandlerTests
{
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IUserTokenRepository> _tokens = new();
    private readonly Mock<IEmailService> _email = new();
    private readonly Mock<IOtpService> _otp = new();
    private readonly Mock<IEmailNormalizer> _normalizer = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly ResendRegistrationOtpCommandHandler _handler;

    public ResendRegistrationOtpCommandHandlerTests()
    {
        _normalizer.Setup(x => x.Normalize(It.IsAny<string>()))
            .Returns<string>(value => value.Trim().ToLowerInvariant());
        _handler = new ResendRegistrationOtpCommandHandler(
            _users.Object,
            _tokens.Object,
            _email.Object,
            _otp.Object,
            _normalizer.Object,
            _unitOfWork.Object,
            Options.Create(new AuthenticationSettings
            {
                Otp = new OtpSettings { Length = 6, ExpirationMinutes = 15 }
            }),
            Mock.Of<ILogger<ResendRegistrationOtpCommandHandler>>());
    }

    [Fact]
    public async Task Handle_ShouldCreateAndSendNewOtp_ForPendingUnverifiedUser()
    {
        var user = PendingUser();
        var expiredToken = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenType = "EMAIL_OTP",
            TokenHash = "old",
            CreatedAt = DateTime.UtcNow.AddMinutes(-2),
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };
        _users.Setup(x => x.GetByEmailAsync(user.Email, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _tokens.Setup(x => x.GetLatestActiveOtpAsync(user.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expiredToken);
        _otp.Setup(x => x.GenerateNumericOtp(6)).Returns("654321");
        _otp.Setup(x => x.HashOtp("654321")).Returns("new-hash");
        _email.Setup(x => x.SendEmailAsync(user.Email, It.IsAny<string>(), It.Is<string>(body => body.Contains("654321")), It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Success("message-id"));

        UserToken? createdToken = null;
        _tokens.Setup(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()))
            .Callback<UserToken, CancellationToken>((token, _) => createdToken = token);

        var result = await _handler.Handle(new ResendRegistrationOtpCommand(user.Email), CancellationToken.None);

        result.Success.Should().BeTrue();
        createdToken.Should().NotBeNull();
        createdToken!.TokenType.Should().Be("EMAIL_OTP");
        createdToken.TokenHash.Should().Be("new-hash");
        createdToken.AttemptCount.Should().Be(0);
        _tokens.Verify(x => x.InvalidateActiveTokensAsync(user.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _email.VerifyAll();
    }

    [Fact]
    public async Task Handle_ShouldNotCreateOtp_WhenUserAlreadyVerified()
    {
        var user = PendingUser();
        user.EmailVerifiedAt = DateTime.UtcNow;
        _users.Setup(x => x.GetByEmailAsync(user.Email, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var result = await _handler.Handle(new ResendRegistrationOtpCommand(user.Email), CancellationToken.None);

        result.Success.Should().BeTrue();
        _tokens.Verify(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()), Times.Never);
        _email.Verify(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldRespectCooldown()
    {
        var user = PendingUser();
        _users.Setup(x => x.GetByEmailAsync(user.Email, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _tokens.Setup(x => x.GetLatestActiveOtpAsync(user.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserToken
            {
                TokenId = Guid.NewGuid(),
                UserId = user.UserId,
                TokenType = "EMAIL_OTP",
                TokenHash = "recent",
                CreatedAt = DateTime.UtcNow.AddSeconds(-10),
                ExpiresAt = DateTime.UtcNow.AddMinutes(14)
            });

        await _handler.Handle(new ResendRegistrationOtpCommand(user.Email), CancellationToken.None);

        _tokens.Verify(x => x.InvalidateActiveTokensAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _tokens.Verify(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldInvalidateNewToken_WhenEmailDeliveryFails()
    {
        var user = PendingUser();
        _users.Setup(x => x.GetByEmailAsync(user.Email, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _otp.Setup(x => x.GenerateNumericOtp(6)).Returns("123456");
        _otp.Setup(x => x.HashOtp("123456")).Returns("hash");
        _email.Setup(x => x.SendEmailAsync(user.Email, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Failure("provider unavailable"));

        UserToken? createdToken = null;
        _tokens.Setup(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()))
            .Callback<UserToken, CancellationToken>((token, _) => createdToken = token);

        var act = () => _handler.Handle(new ResendRegistrationOtpCommand(user.Email), CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>();
        createdToken!.UsedAt.Should().NotBeNull();
        _tokens.Verify(x => x.Update(createdToken), Times.Once);
        _unitOfWork.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    private static AppUser PendingUser() => new()
    {
        UserId = Guid.NewGuid(),
        Email = "pending@example.com",
        DisplayName = "Pending User",
        PasswordHash = "hash",
        Status = "PENDING"
    };
}
