using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.RegisterClient;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.RegisterClient;

public class RegisterClientCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<ICompanyRepository> _companyRepositoryMock;
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock;
    private readonly Mock<ICompanyVerificationRequestRepository> _companyVerificationRequestRepositoryMock;
    private readonly Mock<IUserTokenRepository> _userTokenRepositoryMock;
    private readonly Mock<IEmailOutboxRepository> _emailOutboxRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IPasswordHasher> _passwordHasherMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IPhoneNormalizer> _phoneNormalizerMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILogger<RegisterClientCommandHandler>> _loggerMock;
    private readonly IOptions<AuthenticationSettings> _authOptions;

    private readonly RegisterClientCommandHandler _handler;

    public RegisterClientCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _companyRepositoryMock = new Mock<ICompanyRepository>();
        _companyUserRepositoryMock = new Mock<ICompanyUserRepository>();
        _companyVerificationRequestRepositoryMock = new Mock<ICompanyVerificationRequestRepository>();
        _userTokenRepositoryMock = new Mock<IUserTokenRepository>();
        _emailOutboxRepositoryMock = new Mock<IEmailOutboxRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _passwordHasherMock = new Mock<IPasswordHasher>();
        _otpServiceMock = new Mock<IOtpService>();
        _phoneNormalizerMock = new Mock<IPhoneNormalizer>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _emailServiceMock = new Mock<IEmailService>();
        _loggerMock = new Mock<ILogger<RegisterClientCommandHandler>>();

        _authOptions = Options.Create(new AuthenticationSettings
        {
            Otp = new OtpSettings
            {
                Length = 6,
                ExpirationMinutes = 15
            }
        });

        _handler = new RegisterClientCommandHandler(
            _userRepositoryMock.Object,
            _companyRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _companyVerificationRequestRepositoryMock.Object,
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
        var command = new RegisterClientCommand(
            Email: "client@example.com",
            Password: "Password@123",
            FullName: "Tran Thi B",
            Phone: "0912345678",
            CompanyName: "ABC Technology"
        );

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("client@example.com");
        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync("client@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Email này đã được sử dụng*");
    }

    [Fact]
    public async Task Handle_ShouldThrowConflictException_WhenTaxCodeAlreadyExists()
    {
        var command = new RegisterClientCommand(
            Email: "newclient@example.com",
            Password: "Password@123",
            FullName: "Tran Thi B",
            Phone: "0912345678",
            CompanyName: "ABC Technology",
            TaxCode: "0123456789"
        );

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("newclient@example.com");
        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync("newclient@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _companyRepositoryMock.Setup(x => x.ExistsByTaxCodeAsync("0123456789", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Mã số thuế này đã được đăng ký*");
    }

    [Fact]
    public async Task Handle_ShouldSuccessfullyRegisterClientCompany_WithoutGrantingRole()
    {
        var command = new RegisterClientCommand(
            Email: "hr@abctech.vn",
            Password: "Password@123",
            FullName: "Tran Thi B",
            Phone: "0912345678",
            CompanyName: "ABC Technology",
            TaxCode: "0123456789"
        );

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("hr@abctech.vn");
        _phoneNormalizerMock.Setup(x => x.Normalize(command.Phone)).Returns("+84912345678");
        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync("hr@abctech.vn", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _companyRepositoryMock.Setup(x => x.ExistsByTaxCodeAsync("0123456789", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _passwordHasherMock.Setup(x => x.Hash(command.Password)).Returns("hashed_password_client");
        _otpServiceMock.Setup(x => x.GenerateNumericOtp(6)).Returns("998877");
        _otpServiceMock.Setup(x => x.HashOtp("998877")).Returns("hashed_otp_client");
        _emailServiceMock.Setup(x => x.SendEmailAsync(
                command.Email,
                It.IsAny<string>(),
                It.Is<string>(body => body.Contains("998877")),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Success("message-id"));

        AppUser? capturedUser = null;
        _userRepositoryMock.Setup(x => x.AddAsync(It.IsAny<AppUser>(), It.IsAny<CancellationToken>()))
            .Callback<AppUser, CancellationToken>((u, ct) => capturedUser = u)
            .Returns(Task.CompletedTask);

        Company? capturedCompany = null;
        _companyRepositoryMock.Setup(x => x.AddAsync(It.IsAny<Company>(), It.IsAny<CancellationToken>()))
            .Callback<Company, CancellationToken>((c, ct) => capturedCompany = c)
            .Returns(Task.CompletedTask);

        CompanyUser? capturedCompanyUser = null;
        _companyUserRepositoryMock.Setup(x => x.AddAsync(It.IsAny<CompanyUser>(), It.IsAny<CancellationToken>()))
            .Callback<CompanyUser, CancellationToken>((cu, ct) => capturedCompanyUser = cu)
            .Returns(Task.CompletedTask);

        CompanyVerificationRequest? capturedReq = null;
        _companyVerificationRequestRepositoryMock.Setup(x => x.AddAsync(It.IsAny<CompanyVerificationRequest>(), It.IsAny<CancellationToken>()))
            .Callback<CompanyVerificationRequest, CancellationToken>((r, ct) => capturedReq = r)
            .Returns(Task.CompletedTask);

        EmailOutbox? capturedOutbox = null;
        _emailOutboxRepositoryMock.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((outbox, _) => capturedOutbox = outbox)
            .Returns(Task.CompletedTask);

        var response = await _handler.Handle(command, CancellationToken.None);

        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Data!.Status.Should().Be("PENDING_EMAIL_VERIFICATION");
        response.Data.Email.Should().Be("hr@abctech.vn");

        capturedUser.Should().NotBeNull();
        capturedUser!.Status.Should().Be("PENDING");
        capturedUser.EmailVerifiedAt.Should().BeNull();

        capturedCompany.Should().NotBeNull();
        capturedCompany!.CompanyName.Should().Be("ABC Technology");
        capturedCompany.VerificationStatus.Should().Be("PENDING");

        capturedCompanyUser.Should().NotBeNull();
        capturedCompanyUser!.CompanyId.Should().Be(capturedCompany.CompanyId);
        capturedCompanyUser.UserId.Should().Be(capturedUser.UserId);
        capturedCompanyUser.IsPrimaryContact.Should().BeTrue();
        capturedCompanyUser.Status.Should().Be("ACTIVE");

        capturedReq.Should().NotBeNull();
        capturedReq!.CompanyId.Should().Be(capturedCompany.CompanyId);
        capturedReq.SubmittedBy.Should().Be(capturedUser.UserId);
        capturedReq.Status.Should().Be("PENDING");

        capturedOutbox.Should().NotBeNull();
        capturedOutbox!.Status.Should().Be("SENT");
        capturedOutbox.SentAt.Should().NotBeNull();
        capturedOutbox.Payload.Should().NotContain("998877");

        _unitOfWorkMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _emailServiceMock.VerifyAll();
    }

    [Fact]
    public async Task Handle_ShouldKeepRegistrationRecoverable_WhenEmailProviderFails()
    {
        var command = new RegisterClientCommand(
            "client-mail-failure@example.com", "Password@123", "Client Mail Failure", null, "Mail Failure Co");
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
