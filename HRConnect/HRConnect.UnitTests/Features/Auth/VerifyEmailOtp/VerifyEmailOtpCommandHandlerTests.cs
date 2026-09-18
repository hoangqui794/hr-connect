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
    private readonly Mock<IAffiliateApplicationRepository> _affiliateApplicationRepositoryMock;
    private readonly Mock<ICompanyVerificationRequestRepository> _companyVerificationRequestRepositoryMock;
    private readonly Mock<ICompanyRepository> _companyRepositoryMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<VerifyEmailOtpCommandHandler>> _loggerMock;

    private readonly VerifyEmailOtpCommandHandler _handler;

    public VerifyEmailOtpCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _userTokenRepositoryMock = new Mock<IUserTokenRepository>();
        _affiliateApplicationRepositoryMock = new Mock<IAffiliateApplicationRepository>();
        _companyVerificationRequestRepositoryMock = new Mock<ICompanyVerificationRequestRepository>();
        _companyRepositoryMock = new Mock<ICompanyRepository>();
        _emailServiceMock = new Mock<IEmailService>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _otpServiceMock = new Mock<IOtpService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<VerifyEmailOtpCommandHandler>>();

        _handler = new VerifyEmailOtpCommandHandler(
            _userRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _affiliateApplicationRepositoryMock.Object,
            _companyVerificationRequestRepositoryMock.Object,
            _companyRepositoryMock.Object,
            _emailServiceMock.Object,
            _emailNormalizerMock.Object,
            _otpServiceMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenUserNotFound()
    {
        var command = new VerifyEmailOtpCommand("notfound@example.com", "123456");
        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("notfound@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("notfound@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Không tìm thấy tài khoản*");
    }

    [Fact]
    public async Task Handle_ShouldReturnSuccess_WhenUserIsAlreadyActive()
    {
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

        var result = await _handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("đã được xác thực email từ trước");
        result.Data!.Status.Should().Be("ACTIVE");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenNoActiveTokenExists()
    {
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

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Mã OTP không tồn tại hoặc đã được sử dụng*");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenAttemptCountExceedsMaxLimit()
    {
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
            AttemptCount = 5,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("pending@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("pending@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(pendingUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*quá 5 lần*Mã xác thực này đã bị khóa*");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenOtpIsExpired()
    {
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
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5)
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("pending@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("pending@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(pendingUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expiredToken);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Mã OTP đã hết hạn*");
    }

    [Fact]
    public async Task Handle_ShouldIncrementAttemptCountAndThrow_WhenOtpIsIncorrect()
    {
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

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Mã OTP không chính xác*");

        token.AttemptCount.Should().Be(2);
        _userTokenRepositoryMock.Verify(x => x.Update(token), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldActivateUserAndMarkTokenUsed_WhenCandidateVerifiesOtp()
    {
        var command = new VerifyEmailOtpCommand("candidate@example.com", "123456");
        var pendingUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "candidate@example.com",
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

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("candidate@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("candidate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(pendingUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);
        _otpServiceMock.Setup(x => x.VerifyOtp("123456", "valid_hash")).Returns(true);

        _affiliateApplicationRepositoryMock.Setup(x => x.GetByUserIdAsync(pendingUser.UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateApplication?)null);
        _companyVerificationRequestRepositoryMock.Setup(x => x.GetByUserIdAsync(pendingUser.UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyVerificationRequest?)null);

        var result = await _handler.Handle(command, CancellationToken.None);

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

    [Fact]
    public async Task Handle_ShouldTransitionToPendingAdminApproval_WhenAffiliateVerifiesOtp()
    {
        var command = new VerifyEmailOtpCommand("affiliate@example.com", "123456");
        var affiliateUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate@example.com",
            Status = "PENDING",
            EmailVerifiedAt = null
        };
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = affiliateUser.UserId,
            TokenHash = "valid_hash",
            AttemptCount = 0,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            UsedAt = null
        };
        var affiliateApp = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(),
            UserId = affiliateUser.UserId,
            AffiliateType = "RECRUITER",
            Status = "PENDING"
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("affiliate@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("affiliate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliateUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(affiliateUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);
        _otpServiceMock.Setup(x => x.VerifyOtp("123456", "valid_hash")).Returns(true);

        _affiliateApplicationRepositoryMock.Setup(x => x.GetByUserIdAsync(affiliateUser.UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliateApp);

        var result = await _handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("pending Admin approval");
        result.Data!.Status.Should().Be("PENDING_ADMIN_APPROVAL");

        // QUY TẮC: User status vẫn là PENDING, đơn chuyển sang UNDER_REVIEW
        affiliateUser.Status.Should().Be("PENDING");
        affiliateUser.EmailVerifiedAt.Should().NotBeNull();
        affiliateApp.Status.Should().Be("UNDER_REVIEW");

        _affiliateApplicationRepositoryMock.Verify(x => x.Update(affiliateApp), Times.Once);
        _userRepositoryMock.Verify(x => x.Update(affiliateUser), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldTransitionToPendingAdminApproval_WhenClientVerifiesOtp()
    {
        var command = new VerifyEmailOtpCommand("client@example.com", "123456");
        var clientUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "client@example.com",
            Status = "PENDING",
            EmailVerifiedAt = null
        };
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = clientUser.UserId,
            TokenHash = "valid_hash",
            AttemptCount = 0,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            UsedAt = null
        };
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Test Company",
            VerificationStatus = "PENDING"
        };
        var companyVerification = new CompanyVerificationRequest
        {
            CompanyVerificationRequestId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            SubmittedBy = clientUser.UserId,
            Status = "PENDING"
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("client@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("client@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(clientUser);
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(clientUser.UserId, "EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);
        _otpServiceMock.Setup(x => x.VerifyOtp("123456", "valid_hash")).Returns(true);

        _affiliateApplicationRepositoryMock.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateApplication?)null);
        _companyVerificationRequestRepositoryMock.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(companyVerification);
        _companyRepositoryMock.Setup(x => x.GetByIdAsync(company.CompanyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(company);

        var result = await _handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("pending Admin approval");
        result.Data!.Status.Should().Be("PENDING_ADMIN_APPROVAL");

        // QUY TẮC: User status vẫn là PENDING, request & company chuyển sang UNDER_REVIEW
        clientUser.Status.Should().Be("PENDING");
        clientUser.EmailVerifiedAt.Should().NotBeNull();
        companyVerification.Status.Should().Be("UNDER_REVIEW");
        company.VerificationStatus.Should().Be("UNDER_REVIEW");

        _companyVerificationRequestRepositoryMock.Verify(x => x.Update(companyVerification), Times.Once);
        _companyRepositoryMock.Verify(x => x.Update(company), Times.Once);
        _userRepositoryMock.Verify(x => x.Update(clientUser), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
