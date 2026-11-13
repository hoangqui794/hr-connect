using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.SplitAccount;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.SplitAccount;

public class SplitAccountCommandHandlersTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IUserEmailIdentityRepository> _userEmailIdentityRepositoryMock = new();
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock = new();
    private readonly Mock<IRoleRepository> _roleRepositoryMock = new();
    private readonly Mock<IUserRoleRepository> _userRoleRepositoryMock = new();
    private readonly Mock<IUserTokenRepository> _userTokenRepositoryMock = new();
    private readonly Mock<IAuditLogService> _auditLogServiceMock = new();
    private readonly Mock<IPasswordHasher> _passwordHasherMock = new();
    private readonly Mock<IOtpService> _otpServiceMock = new();
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock = new();
    private readonly Mock<IPhoneNormalizer> _phoneNormalizerMock = new();
    private readonly Mock<IEmailService> _emailServiceMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();

    private readonly IOptions<AuthenticationSettings> _authOptions = Options.Create(new AuthenticationSettings
    {
        Otp = new OtpSettings { Length = 6, ExpirationMinutes = 15 }
    });

    [Fact]
    public async Task RequestSplitOtp_ShouldReject_WhenEmailIsNotAlias()
    {
        var handler = new RequestSplitOtpCommandHandler(
            _userEmailIdentityRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _emailNormalizerMock.Object,
            _otpServiceMock.Object,
            _emailServiceMock.Object,
            _unitOfWorkMock.Object,
            _authOptions,
            Mock.Of<ILogger<RequestSplitOtpCommandHandler>>());

        _emailNormalizerMock.Setup(x => x.Normalize("primary@example.com")).Returns("primary@example.com");
        _userEmailIdentityRepositoryMock.Setup(x => x.GetActiveByNormalizedEmailAsync("primary@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity { Kind = "PRIMARY", Status = "VERIFIED" });

        var act = () => handler.Handle(new RequestSplitOtpCommand("primary@example.com"), CancellationToken.None);
        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task RequestSplitOtp_ShouldSendOtp_WhenEmailIsVerifiedAlias()
    {
        var handler = new RequestSplitOtpCommandHandler(
            _userEmailIdentityRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _emailNormalizerMock.Object,
            _otpServiceMock.Object,
            _emailServiceMock.Object,
            _unitOfWorkMock.Object,
            _authOptions,
            Mock.Of<ILogger<RequestSplitOtpCommandHandler>>());

        var aliasEmail = "alias@example.com";
        var oldUserId = Guid.NewGuid();

        _emailNormalizerMock.Setup(x => x.Normalize(aliasEmail)).Returns(aliasEmail);
        _userEmailIdentityRepositoryMock.Setup(x => x.GetActiveByNormalizedEmailAsync(aliasEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity { UserId = oldUserId, Kind = "ALIAS", Status = "VERIFIED" });
        _otpServiceMock.Setup(x => x.GenerateNumericOtp(6)).Returns("123456");
        _otpServiceMock.Setup(x => x.HashOtp("123456")).Returns("hash_123456");

        var result = await handler.Handle(new RequestSplitOtpCommand(aliasEmail), CancellationToken.None);

        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        _userTokenRepositoryMock.Verify(x => x.AddAsync(It.Is<UserToken>(t => t.UserId == oldUserId && t.TokenType == "SPLIT_EMAIL_OTP"), It.IsAny<CancellationToken>()), Times.Once);
        _emailServiceMock.Verify(x => x.SendEmailAsync(aliasEmail, It.IsAny<string>(), It.Is<string>(body => body.Contains("123456")), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ConfirmSplitRegister_ShouldRevokeOldIdentityAndCreateNewAccount_WhenOtpValid()
    {
        var handler = new ConfirmSplitRegisterCommandHandler(
            _userRepositoryMock.Object,
            _userEmailIdentityRepositoryMock.Object,
            _candidateRepositoryMock.Object,
            _roleRepositoryMock.Object,
            _userRoleRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _auditLogServiceMock.Object,
            _passwordHasherMock.Object,
            _otpServiceMock.Object,
            _emailNormalizerMock.Object,
            _phoneNormalizerMock.Object,
            _unitOfWorkMock.Object,
            Mock.Of<ILogger<ConfirmSplitRegisterCommandHandler>>());

        var email = "alias@example.com";
        var oldUserId = Guid.NewGuid();
        var command = new ConfirmSplitRegisterCommand(email, "NewPass@123", "New Candidate", "0909999999", "123456");

        _emailNormalizerMock.Setup(x => x.Normalize(email)).Returns(email);
        _phoneNormalizerMock.Setup(x => x.Normalize(command.Phone)).Returns("+84909999999");

        var activeIdentity = new UserEmailIdentity
        {
            EmailIdentityId = Guid.NewGuid(),
            UserId = oldUserId,
            Email = email,
            NormalizedEmail = email,
            Kind = "ALIAS",
            Status = "VERIFIED"
        };
        _userEmailIdentityRepositoryMock.Setup(x => x.GetActiveByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(activeIdentity);

        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = oldUserId,
            TokenType = "SPLIT_EMAIL_OTP",
            TokenHash = "hash_123456",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            AttemptCount = 0
        };
        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(oldUserId, "SPLIT_EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);

        _otpServiceMock.Setup(x => x.VerifyOtp("123456", "hash_123456")).Returns(true);
        _passwordHasherMock.Setup(x => x.Hash(command.Password)).Returns("hashed_pwd");

        var role = new Role { RoleId = Guid.NewGuid(), Code = "CANDIDATE" };
        _roleRepositoryMock.Setup(x => x.GetByCodeAsync("CANDIDATE", It.IsAny<CancellationToken>()))
            .ReturnsAsync(role);

        var archivedCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            NormalizedEmail = email,
            Status = "ARCHIVED",
            MergedIntoCandidateId = Guid.NewGuid()
        };
        _candidateRepositoryMock.Setup(x => x.GetByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(archivedCandidate);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data!.Email.Should().Be(email);
        result.Data.Status.Should().Be("ACTIVE");

        // Old identity must be revoked with RevokedAt timestamp set
        activeIdentity.Status.Should().Be("REVOKED");
        activeIdentity.RevokedAt.Should().NotBeNull();

        // Archived candidate profile must be restored to ACTIVE and unmerged
        archivedCandidate.Status.Should().Be("ACTIVE");
        archivedCandidate.MergedIntoCandidateId.Should().BeNull();
        archivedCandidate.UserId.Should().Be(result.Data.UserId);

        _userRepositoryMock.Verify(x => x.AddAsync(It.Is<AppUser>(u => u.Email == email && u.Status == "ACTIVE"), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ConfirmSplitRegister_ShouldRestoreArchivedPlaceholderForPreviousOwner_WhenSplitCandidateWasSwappedDuringMerge()
    {
        var handler = new ConfirmSplitRegisterCommandHandler(
            _userRepositoryMock.Object,
            _userEmailIdentityRepositoryMock.Object,
            _candidateRepositoryMock.Object,
            _roleRepositoryMock.Object,
            _userRoleRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _auditLogServiceMock.Object,
            _passwordHasherMock.Object,
            _otpServiceMock.Object,
            _emailNormalizerMock.Object,
            _phoneNormalizerMock.Object,
            _unitOfWorkMock.Object,
            Mock.Of<ILogger<ConfirmSplitRegisterCommandHandler>>());

        var email = "alias-aff@example.com";
        var oldUserId = Guid.NewGuid();
        var command = new ConfirmSplitRegisterCommand(email, "NewPass@123", "Split Candidate", "0909888777", "123456");

        _emailNormalizerMock.Setup(x => x.Normalize(email)).Returns(email);
        _phoneNormalizerMock.Setup(x => x.Normalize(command.Phone)).Returns("+84909888777");

        _userEmailIdentityRepositoryMock.Setup(x => x.GetActiveByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = oldUserId,
                Email = email,
                NormalizedEmail = email,
                Kind = "ALIAS",
                Status = "VERIFIED"
            });

        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(oldUserId, "SPLIT_EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserToken
            {
                TokenId = Guid.NewGuid(),
                UserId = oldUserId,
                TokenType = "SPLIT_EMAIL_OTP",
                TokenHash = "hash_123456",
                ExpiresAt = DateTime.UtcNow.AddMinutes(10)
            });

        _otpServiceMock.Setup(x => x.VerifyOtp("123456", "hash_123456")).Returns(true);
        _passwordHasherMock.Setup(x => x.Hash(command.Password)).Returns("hashed_pwd");
        _roleRepositoryMock.Setup(x => x.GetByCodeAsync("CANDIDATE", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Role { RoleId = Guid.NewGuid(), Code = "CANDIDATE" });

        var swappedCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = oldUserId,
            NormalizedEmail = email,
            Status = "ACTIVE"
        };
        var archivedPlaceholder = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = null,
            NormalizedEmail = "primary@example.com",
            Status = "ARCHIVED",
            MergedIntoCandidateId = swappedCandidate.CandidateId
        };

        _candidateRepositoryMock.Setup(x => x.GetByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(swappedCandidate);
        _candidateRepositoryMock.Setup(x => x.GetByUserIdAsync(oldUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);
        _candidateRepositoryMock.Setup(x => x.GetArchivedMergedSourceAsync(swappedCandidate.CandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(archivedPlaceholder);

        var result = await handler.Handle(command, CancellationToken.None);

        swappedCandidate.UserId.Should().Be(result.Data!.UserId);
        archivedPlaceholder.Status.Should().Be("ACTIVE");
        archivedPlaceholder.MergedIntoCandidateId.Should().BeNull();
        archivedPlaceholder.UserId.Should().Be(oldUserId);
        _candidateRepositoryMock.Verify(x => x.Update(archivedPlaceholder), Times.Once);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ConfirmSplitRegister_ShouldCreateFallbackCandidateForPreviousOwner_WhenNoArchivedPlaceholderExists()
    {
        var handler = new ConfirmSplitRegisterCommandHandler(
            _userRepositoryMock.Object,
            _userEmailIdentityRepositoryMock.Object,
            _candidateRepositoryMock.Object,
            _roleRepositoryMock.Object,
            _userRoleRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _auditLogServiceMock.Object,
            _passwordHasherMock.Object,
            _otpServiceMock.Object,
            _emailNormalizerMock.Object,
            _phoneNormalizerMock.Object,
            _unitOfWorkMock.Object,
            Mock.Of<ILogger<ConfirmSplitRegisterCommandHandler>>());

        var email = "alias-aff@example.com";
        var oldUserId = Guid.NewGuid();
        var command = new ConfirmSplitRegisterCommand(email, "NewPass@123", "Split Candidate", null, "123456");

        _emailNormalizerMock.Setup(x => x.Normalize(email)).Returns(email);
        _emailNormalizerMock.Setup(x => x.Normalize("owner@example.com")).Returns("owner@example.com");
        _phoneNormalizerMock.Setup(x => x.Normalize(null)).Returns(string.Empty);

        _userEmailIdentityRepositoryMock.Setup(x => x.GetActiveByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = oldUserId,
                Email = email,
                NormalizedEmail = email,
                Kind = "ALIAS",
                Status = "VERIFIED"
            });

        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(oldUserId, "SPLIT_EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserToken
            {
                TokenId = Guid.NewGuid(),
                UserId = oldUserId,
                TokenType = "SPLIT_EMAIL_OTP",
                TokenHash = "hash_123456",
                ExpiresAt = DateTime.UtcNow.AddMinutes(10)
            });

        _otpServiceMock.Setup(x => x.VerifyOtp("123456", "hash_123456")).Returns(true);
        _passwordHasherMock.Setup(x => x.Hash(command.Password)).Returns("hashed_pwd");
        _roleRepositoryMock.Setup(x => x.GetByCodeAsync("CANDIDATE", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Role { RoleId = Guid.NewGuid(), Code = "CANDIDATE" });

        var swappedCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = oldUserId,
            NormalizedEmail = email,
            Status = "ACTIVE"
        };

        _candidateRepositoryMock.Setup(x => x.GetByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(swappedCandidate);
        _candidateRepositoryMock.Setup(x => x.GetByUserIdAsync(oldUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);
        _candidateRepositoryMock.Setup(x => x.GetArchivedMergedSourceAsync(swappedCandidate.CandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);
        _userRepositoryMock.Setup(x => x.GetByIdAsync(oldUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AppUser
            {
                UserId = oldUserId,
                Email = "owner@example.com",
                DisplayName = "Khúc Ngọc Sơn"
            });

        await handler.Handle(command, CancellationToken.None);

        _candidateRepositoryMock.Verify(x => x.AddAsync(
            It.Is<Candidate>(c =>
                c.UserId == oldUserId &&
                c.Status == "ACTIVE" &&
                c.NormalizedEmail == "owner@example.com" &&
                c.FullName == "Khúc Ngọc Sơn"),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ConfirmSplitRegister_ShouldReject_WhenPhoneMatchesPreviousOwnerPhone()
    {
        var handler = new ConfirmSplitRegisterCommandHandler(
            _userRepositoryMock.Object,
            _userEmailIdentityRepositoryMock.Object,
            _candidateRepositoryMock.Object,
            _roleRepositoryMock.Object,
            _userRoleRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _auditLogServiceMock.Object,
            _passwordHasherMock.Object,
            _otpServiceMock.Object,
            _emailNormalizerMock.Object,
            _phoneNormalizerMock.Object,
            _unitOfWorkMock.Object,
            Mock.Of<ILogger<ConfirmSplitRegisterCommandHandler>>());

        var email = "alias-aff@example.com";
        var oldUserId = Guid.NewGuid();
        var command = new ConfirmSplitRegisterCommand(email, "NewPass@123", "Split Candidate", "0909111222", "123456");

        _emailNormalizerMock.Setup(x => x.Normalize(email)).Returns(email);
        _phoneNormalizerMock.Setup(x => x.Normalize(command.Phone)).Returns("+84909111222");

        _userEmailIdentityRepositoryMock.Setup(x => x.GetActiveByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = oldUserId,
                Email = email,
                NormalizedEmail = email,
                Kind = "ALIAS",
                Status = "VERIFIED"
            });

        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(oldUserId, "SPLIT_EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserToken
            {
                TokenId = Guid.NewGuid(),
                UserId = oldUserId,
                TokenType = "SPLIT_EMAIL_OTP",
                TokenHash = "hash_123456",
                ExpiresAt = DateTime.UtcNow.AddMinutes(10)
            });

        _otpServiceMock.Setup(x => x.VerifyOtp("123456", "hash_123456")).Returns(true);

        var swappedCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = oldUserId,
            NormalizedEmail = email,
            Status = "ACTIVE"
        };
        _candidateRepositoryMock.Setup(x => x.GetByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(swappedCandidate);
        _userRepositoryMock.Setup(x => x.GetByIdAsync(oldUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AppUser
            {
                UserId = oldUserId,
                Email = "owner@example.com",
                NormalizedPhone = "+84909111222"
            });

        var act = () => handler.Handle(command, CancellationToken.None);
        var error = await act.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("PHONE_ALREADY_REGISTERED");
        _unitOfWorkMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmSplitRegister_ShouldReject_WhenPhoneBelongsToAnotherActiveCandidate()
    {
        var handler = new ConfirmSplitRegisterCommandHandler(
            _userRepositoryMock.Object,
            _userEmailIdentityRepositoryMock.Object,
            _candidateRepositoryMock.Object,
            _roleRepositoryMock.Object,
            _userRoleRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _auditLogServiceMock.Object,
            _passwordHasherMock.Object,
            _otpServiceMock.Object,
            _emailNormalizerMock.Object,
            _phoneNormalizerMock.Object,
            _unitOfWorkMock.Object,
            Mock.Of<ILogger<ConfirmSplitRegisterCommandHandler>>());

        var email = "alias-aff@example.com";
        var oldUserId = Guid.NewGuid();
        var command = new ConfirmSplitRegisterCommand(email, "NewPass@123", "Split Candidate", "0909333444", "123456");

        _emailNormalizerMock.Setup(x => x.Normalize(email)).Returns(email);
        _phoneNormalizerMock.Setup(x => x.Normalize(command.Phone)).Returns("+84909333444");

        _userEmailIdentityRepositoryMock.Setup(x => x.GetActiveByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = oldUserId,
                Email = email,
                NormalizedEmail = email,
                Kind = "ALIAS",
                Status = "VERIFIED"
            });

        _userTokenRepositoryMock.Setup(x => x.GetLatestActiveOtpAsync(oldUserId, "SPLIT_EMAIL_OTP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserToken
            {
                TokenId = Guid.NewGuid(),
                UserId = oldUserId,
                TokenType = "SPLIT_EMAIL_OTP",
                TokenHash = "hash_123456",
                ExpiresAt = DateTime.UtcNow.AddMinutes(10)
            });

        _otpServiceMock.Setup(x => x.VerifyOtp("123456", "hash_123456")).Returns(true);

        var candidateToSplit = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = null,
            NormalizedEmail = email,
            Status = "ARCHIVED"
        };
        _candidateRepositoryMock.Setup(x => x.GetByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidateToSplit);
        _candidateRepositoryMock.Setup(x => x.GetByNormalizedPhoneAsync("+84909333444", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate
            {
                CandidateId = Guid.NewGuid(),
                UserId = oldUserId,
                NormalizedPhone = "+84909333444",
                Status = "ACTIVE"
            });

        var act = () => handler.Handle(command, CancellationToken.None);
        var error = await act.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("PHONE_ALREADY_REGISTERED");
        _unitOfWorkMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}

