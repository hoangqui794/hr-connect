using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.Login;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.Login;

public class LoginCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepositoryMock;
    private readonly Mock<IPasswordHasher> _passwordHasherMock;
    private readonly Mock<IJwtTokenGenerator> _jwtTokenGeneratorMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<LoginCommandHandler>> _loggerMock;
    private readonly IOptions<JwtSettings> _jwtOptions;

    private readonly LoginCommandHandler _handler;

    public LoginCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _refreshTokenRepositoryMock = new Mock<IRefreshTokenRepository>();
        _passwordHasherMock = new Mock<IPasswordHasher>();
        _jwtTokenGeneratorMock = new Mock<IJwtTokenGenerator>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _otpServiceMock = new Mock<IOtpService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<LoginCommandHandler>>();

        _jwtOptions = Options.Create(new JwtSettings
        {
            Secret = "SuperSecretKeyForTestingJwtTokens123456!",
            Issuer = "HRConnect",
            Audience = "HRConnectApp",
            ExpiryMinutes = 60,
            RefreshTokenExpiryDays = 7
        });

        _handler = new LoginCommandHandler(
            _userRepositoryMock.Object,
            _refreshTokenRepositoryMock.Object,
            _passwordHasherMock.Object,
            _jwtTokenGeneratorMock.Object,
            _emailNormalizerMock.Object,
            _otpServiceMock.Object,
            _unitOfWorkMock.Object,
            _jwtOptions,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorizedException_WhenUserDoesNotExist()
    {
        // Arrange
        var command = new LoginCommand("notfound@example.com", "Password@123");
        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("notfound@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("notfound@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("*Email hoặc mật khẩu không chính xác*");
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorizedException_WhenPasswordIsIncorrect()
    {
        // Arrange
        var command = new LoginCommand("user@example.com", "WrongPassword@123");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = "stored_hashed_password",
            Status = "ACTIVE"
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("user@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("WrongPassword@123", "stored_hashed_password"))
            .Returns(false);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("*Email hoặc mật khẩu không chính xác*");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenUserStatusIsPending()
    {
        // Arrange
        var command = new LoginCommand("pending@example.com", "Password@123");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "pending@example.com",
            PasswordHash = "hashed_password",
            Status = "PENDING"
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("pending@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("pending@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("Password@123", "hashed_password"))
            .Returns(true);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*chưa được kích hoạt*");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenUserStatusIsSuspended()
    {
        // Arrange
        var command = new LoginCommand("suspended@example.com", "Password@123");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "suspended@example.com",
            PasswordHash = "hashed_password",
            Status = "SUSPENDED"
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("suspended@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("suspended@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("Password@123", "hashed_password"))
            .Returns(true);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*đã bị khóa*");
    }

    [Fact]
    public async Task Handle_ShouldSuccessfullyLogin_WhenCredentialsAreValid()
    {
        // Arrange
        var command = new LoginCommand("candidate@example.com", "Password@123");
        var role = new Role { RoleId = Guid.NewGuid(), Code = "CANDIDATE", Name = "Candidate" };
        var perm1 = new Permission { PermissionId = Guid.NewGuid(), Code = "job.view", Resource = "job", Action = "view", Description = "Xem tin tuyển dụng" };
        var perm2 = new Permission { PermissionId = Guid.NewGuid(), Code = "application.create", Resource = "application", Action = "create", Description = "Ứng tuyển" };

        role.RolePermissions.Add(new RolePermission { RoleId = role.RoleId, PermissionId = perm1.PermissionId, Permission = perm1 });
        role.RolePermissions.Add(new RolePermission { RoleId = role.RoleId, PermissionId = perm2.PermissionId, Permission = perm2 });

        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "candidate@example.com",
            DisplayName = "Nguyen Van A",
            PasswordHash = "hashed_password",
            Status = "ACTIVE"
        };

        user.UserRoleUsers.Add(new UserRole
        {
            UserId = user.UserId,
            RoleId = role.RoleId,
            Role = role,
            Status = "ACTIVE"
        });

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("candidate@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("candidate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("Password@123", "hashed_password"))
            .Returns(true);

        var expiresAt = DateTime.UtcNow.AddHours(1);
        _jwtTokenGeneratorMock.Setup(x => x.GenerateAccessToken(user, It.IsAny<IEnumerable<string>>(), It.IsAny<IEnumerable<string>>()))
            .Returns(("sample_jwt_token", expiresAt));
        _jwtTokenGeneratorMock.Setup(x => x.GenerateRefreshToken())
            .Returns("sample_refresh_token_64chars");
        _otpServiceMock.Setup(x => x.HashOtp("sample_refresh_token_64chars"))
            .Returns("hashed_refresh_token");

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Data!.AccessToken.Should().Be("sample_jwt_token");
        response.Data.RefreshToken.Should().Be("sample_refresh_token_64chars");
        response.Data.User.Email.Should().Be("candidate@example.com");
        response.Data.User.Roles.Should().ContainSingle().Which.Should().Be("CANDIDATE");
        response.Data.User.Permissions.Should().Contain(new[] { "job.view", "application.create" });

        user.LastLoginAt.Should().NotBeNull();
        _refreshTokenRepositoryMock.Verify(x => x.AddAsync(It.IsAny<RefreshToken>(), It.IsAny<CancellationToken>()), Times.Once);
        _userRepositoryMock.Verify(x => x.Update(user), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowForbiddenException_WhenAffiliateEmailNotVerified()
    {
        var command = new LoginCommand("affiliate@example.com", "Password@123");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate@example.com",
            PasswordHash = "hashed_password",
            Status = "PENDING",
            EmailVerifiedAt = null,
            AffiliateApplicationUser = new AffiliateApplication
            {
                Status = "PENDING"
            }
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("affiliate@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("affiliate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("Password@123", "hashed_password"))
            .Returns(true);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Please verify your email before continuing.");
    }

    [Fact]
    public async Task Handle_ShouldThrowForbiddenException_WhenAffiliatePendingAdminApproval()
    {
        var command = new LoginCommand("affiliate@example.com", "Password@123");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate@example.com",
            PasswordHash = "hashed_password",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow,
            AffiliateApplicationUser = new AffiliateApplication
            {
                Status = "UNDER_REVIEW"
            }
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("affiliate@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("affiliate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("Password@123", "hashed_password"))
            .Returns(true);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Your registration is pending Admin approval.");
    }

    [Fact]
    public async Task Handle_ShouldThrowForbiddenException_WhenAffiliateRejected()
    {
        var command = new LoginCommand("affiliate@example.com", "Password@123");
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate@example.com",
            PasswordHash = "hashed_password",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow,
            AffiliateApplicationUser = new AffiliateApplication
            {
                Status = "REJECTED"
            }
        };

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("affiliate@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("affiliate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("Password@123", "hashed_password"))
            .Returns(true);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Your registration was rejected.");
    }

    [Fact]
    public async Task Handle_ShouldThrowForbiddenException_WhenClientEmailNotVerified()
    {
        var command = new LoginCommand("client@example.com", "Password@123");
        var company = new Company { CompanyId = Guid.NewGuid(), VerificationStatus = "PENDING" };
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "client@example.com",
            PasswordHash = "hashed_password",
            Status = "PENDING",
            EmailVerifiedAt = null
        };
        user.CompanyUsers.Add(new CompanyUser
        {
            Company = company,
            CompanyId = company.CompanyId,
            UserId = user.UserId
        });

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("client@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("client@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("Password@123", "hashed_password"))
            .Returns(true);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Please verify your email before continuing.");
    }

    [Fact]
    public async Task Handle_ShouldThrowForbiddenException_WhenClientPendingAdminApproval()
    {
        var command = new LoginCommand("client@example.com", "Password@123");
        var company = new Company { CompanyId = Guid.NewGuid(), VerificationStatus = "UNDER_REVIEW" };
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "client@example.com",
            PasswordHash = "hashed_password",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow
        };
        user.CompanyUsers.Add(new CompanyUser
        {
            Company = company,
            CompanyId = company.CompanyId,
            UserId = user.UserId
        });

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("client@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("client@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("Password@123", "hashed_password"))
            .Returns(true);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Your registration is pending Admin approval.");
    }

    [Fact]
    public async Task Handle_ShouldThrowForbiddenException_WhenClientRejected()
    {
        var command = new LoginCommand("client@example.com", "Password@123");
        var company = new Company { CompanyId = Guid.NewGuid(), VerificationStatus = "REJECTED" };
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "client@example.com",
            PasswordHash = "hashed_password",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow
        };
        user.CompanyUsers.Add(new CompanyUser
        {
            Company = company,
            CompanyId = company.CompanyId,
            UserId = user.UserId
        });

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("client@example.com");
        _userRepositoryMock.Setup(x => x.GetByEmailWithRolesAndPermissionsAsync("client@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _passwordHasherMock.Setup(x => x.Verify("Password@123", "hashed_password"))
            .Returns(true);

        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Your registration was rejected.");
    }
}
