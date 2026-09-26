using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.RegisterAffiliate;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.RegisterAffiliate;

public class RegisterAffiliateCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IAffiliateApplicationRepository> _affiliateApplicationRepositoryMock;
    private readonly Mock<IUserTokenRepository> _userTokenRepositoryMock;
    private readonly Mock<IEmailOutboxRepository> _emailOutboxRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IPasswordHasher> _passwordHasherMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IPhoneNormalizer> _phoneNormalizerMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILogger<RegisterAffiliateCommandHandler>> _loggerMock;
    private readonly IOptions<AuthenticationSettings> _authOptions;

    private readonly RegisterAffiliateCommandHandler _handler;

    public RegisterAffiliateCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _affiliateApplicationRepositoryMock = new Mock<IAffiliateApplicationRepository>();
        _userTokenRepositoryMock = new Mock<IUserTokenRepository>();
        _emailOutboxRepositoryMock = new Mock<IEmailOutboxRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _passwordHasherMock = new Mock<IPasswordHasher>();
        _otpServiceMock = new Mock<IOtpService>();
        _phoneNormalizerMock = new Mock<IPhoneNormalizer>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _emailServiceMock = new Mock<IEmailService>();
        _loggerMock = new Mock<ILogger<RegisterAffiliateCommandHandler>>();

        _authOptions = Options.Create(new AuthenticationSettings
        {
            Otp = new OtpSettings
            {
                Length = 6,
                ExpirationMinutes = 15
            }
        });

        _handler = new RegisterAffiliateCommandHandler(
            _userRepositoryMock.Object,
            _affiliateApplicationRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _emailOutboxRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _passwordHasherMock.Object,
            _otpServiceMock.Object,
            _phoneNormalizerMock.Object,
            _emailNormalizerMock.Object,
            _emailServiceMock.Object,
            _authOptions,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflictException_WhenEmailAlreadyExists()
    {
        // Arrange
        var command = new RegisterAffiliateCommand(
            Email: "existing@example.com",
            Password: "Password@123",
            FullName: "Nguyen Van A"
        );

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email))
            .Returns("existing@example.com");
        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync("existing@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Email này đã được sử dụng*");
    }

    [Fact]
    public async Task Handle_ShouldSuccessfullyRegisterAffiliate_WithoutGrantingRole()
    {
        // Arrange
        var command = new RegisterAffiliateCommand(
            Email: "newaffiliate@example.com",
            Password: "Password@123",
            FullName: "Nguyen Van A",
            Phone: "0901234567"
        );

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email))
            .Returns("newaffiliate@example.com");
        _phoneNormalizerMock.Setup(x => x.Normalize(command.Phone))
            .Returns("+84901234567");

        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync("newaffiliate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _passwordHasherMock.Setup(x => x.Hash(command.Password))
            .Returns("hashed_secret_password");

        _otpServiceMock.Setup(x => x.GenerateNumericOtp(6))
            .Returns("654321");
        _otpServiceMock.Setup(x => x.HashOtp("654321"))
            .Returns("hashed_otp_token");
        _emailServiceMock
            .Setup(x => x.SendEmailAsync(
                command.Email,
                It.IsAny<string>(),
                It.Is<string>(body => body.Contains("654321")),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Success("message-id"));

        AppUser? capturedUser = null;
        _userRepositoryMock.Setup(x => x.AddAsync(It.IsAny<AppUser>(), It.IsAny<CancellationToken>()))
            .Callback<AppUser, CancellationToken>((u, ct) => capturedUser = u)
            .Returns(Task.CompletedTask);

        AffiliateApplication? capturedApp = null;
        _affiliateApplicationRepositoryMock.Setup(x => x.AddAsync(It.IsAny<AffiliateApplication>(), It.IsAny<CancellationToken>()))
            .Callback<AffiliateApplication, CancellationToken>((a, ct) => capturedApp = a)
            .Returns(Task.CompletedTask);

        UserToken? capturedToken = null;
        _userTokenRepositoryMock.Setup(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()))
            .Callback<UserToken, CancellationToken>((t, ct) => capturedToken = t)
            .Returns(Task.CompletedTask);

        EmailOutbox? capturedOutbox = null;
        _emailOutboxRepositoryMock
            .Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((outbox, _) => capturedOutbox = outbox)
            .Returns(Task.CompletedTask);

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Data!.Status.Should().Be("PENDING_EMAIL_VERIFICATION");
        response.Data.Email.Should().Be("newaffiliate@example.com");

        capturedUser.Should().NotBeNull();
        capturedUser!.Status.Should().Be("PENDING");
        capturedUser.EmailVerifiedAt.Should().BeNull();
        capturedUser.PasswordHash.Should().Be("hashed_secret_password");

        capturedApp.Should().NotBeNull();
        capturedApp!.UserId.Should().Be(capturedUser.UserId);
        capturedApp.Status.Should().Be("PENDING");
        capturedApp.AffiliateType.Should().Be("RECRUITER");

        capturedToken.Should().NotBeNull();
        capturedToken!.TokenType.Should().Be("EMAIL_OTP");
        capturedToken.TokenHash.Should().Be("hashed_otp_token");
        capturedToken.UsedAt.Should().BeNull();

        capturedOutbox.Should().NotBeNull();
        capturedOutbox!.Status.Should().Be("SENT");
        capturedOutbox.SentAt.Should().NotBeNull();
        capturedOutbox.Payload.Should().NotContain("654321");

        _unitOfWorkMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _emailServiceMock.VerifyAll();
    }

    [Fact]
    public async Task Handle_ShouldKeepRegistrationRecoverable_WhenEmailProviderFails()
    {
        var command = new RegisterAffiliateCommand(
            "mail-failure@example.com", "Password@123", "Affiliate Mail Failure");
        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns(command.Email);
        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync(command.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _passwordHasherMock.Setup(x => x.Hash(command.Password)).Returns("password-hash");
        _otpServiceMock.Setup(x => x.GenerateNumericOtp(6)).Returns("123456");
        _otpServiceMock.Setup(x => x.HashOtp("123456")).Returns("otp-hash");
        _emailServiceMock.Setup(x => x.SendEmailAsync(
                command.Email, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Failure("provider unavailable"));

        EmailOutbox? outbox = null;
        _emailOutboxRepositoryMock.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((value, _) => outbox = value);

        var response = await _handler.Handle(command, CancellationToken.None);

        response.Success.Should().BeTrue();
        response.Data!.Status.Should().Be("PENDING_EMAIL_VERIFICATION");
        outbox!.Status.Should().Be("FAILED");
        outbox.RetryCount.Should().Be(1);
        outbox.LastError.Should().Be("provider unavailable");
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
