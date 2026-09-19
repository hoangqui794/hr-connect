using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.RefreshToken;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.RefreshToken;

public class RefreshTokenCommandHandlerTests
{
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepositoryMock;
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IJwtTokenGenerator> _jwtTokenGeneratorMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly IOptions<JwtSettings> _jwtOptions;
    private readonly Mock<ILogger<RefreshTokenCommandHandler>> _loggerMock;

    private readonly RefreshTokenCommandHandler _handler;

    public RefreshTokenCommandHandlerTests()
    {
        _refreshTokenRepositoryMock = new Mock<IRefreshTokenRepository>();
        _userRepositoryMock = new Mock<IUserRepository>();
        _jwtTokenGeneratorMock = new Mock<IJwtTokenGenerator>();
        _otpServiceMock = new Mock<IOtpService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<RefreshTokenCommandHandler>>();

        _jwtOptions = Options.Create(new JwtSettings
        {
            ExpiryMinutes = 60,
            RefreshTokenExpiryDays = 7
        });

        _handler = new RefreshTokenCommandHandler(
            _refreshTokenRepositoryMock.Object,
            _userRepositoryMock.Object,
            _jwtTokenGeneratorMock.Object,
            _otpServiceMock.Object,
            _unitOfWorkMock.Object,
            _jwtOptions,
            _loggerMock.Object);
    }

    private static AppUser CreateActiveUser(Guid userId, string roleCode = "CANDIDATE", string permissionCode = "VIEW_PROFILE")
    {
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = roleCode,
            RolePermissions = new List<RolePermission>
            {
                new() { Permission = new Permission { Code = permissionCode } }
            }
        };

        var user = new AppUser
        {
            UserId = userId,
            Email = "testuser@hrconnect.vn",
            DisplayName = "Test User",
            Status = "ACTIVE",
            EmailVerifiedAt = DateTime.UtcNow
        };

        user.UserRoleUsers.Add(new UserRole
        {
            UserId = userId,
            RoleId = role.RoleId,
            Role = role,
            Status = "ACTIVE"
        });

        return user;
    }

    [Fact]
    public async Task Handle_ShouldSuccessfullyRotateTokens_WhenRefreshTokenIsValid()
    {
        // Arrange
        var rawOldToken = "valid_old_refresh_token_string";
        var tokenHash = "hashed_valid_old_token";
        var userId = Guid.NewGuid();

        var existingToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(3),
            RevokedAt = null,
            ReplacedByTokenId = null,
            CreatedAt = DateTime.UtcNow.AddDays(-4)
        };

        var user = CreateActiveUser(userId, "AFFILIATE_RECRUITER", "REFER_CANDIDATE");

        _otpServiceMock.Setup(x => x.HashOtp(rawOldToken)).Returns(tokenHash);
        _otpServiceMock.Setup(x => x.HashOtp("new_random_refresh_token")).Returns("hashed_new_token");
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingToken);
        _userRepositoryMock.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var newAccessToken = "new_access_token_jwt";
        var accessExpiry = DateTime.UtcNow.AddMinutes(60);
        _jwtTokenGeneratorMock.Setup(x => x.GenerateAccessToken(user, It.IsAny<IEnumerable<string>>(), It.IsAny<IEnumerable<string>>()))
            .Returns((newAccessToken, accessExpiry));
        _jwtTokenGeneratorMock.Setup(x => x.GenerateRefreshToken())
            .Returns("new_random_refresh_token");

        var command = new RefreshTokenCommand(rawOldToken);

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Data.Should().NotBeNull();
        response.Data!.AccessToken.Should().Be(newAccessToken);
        response.Data.RefreshToken.Should().Be("new_random_refresh_token");
        response.Data.User.UserId.Should().Be(userId);
        response.Data.User.Roles.Should().Contain("AFFILIATE_RECRUITER");
        response.Data.User.Permissions.Should().Contain("REFER_CANDIDATE");

        // Verify old token was revoked & marked ROTATED
        existingToken.RevokedAt.Should().NotBeNull();
        existingToken.RevokeReason.Should().Be("ROTATED");
        existingToken.ReplacedByTokenId.Should().NotBeNull();
        _refreshTokenRepositoryMock.Verify(x => x.Update(existingToken), Times.Once);

        // Verify new token was added
        _refreshTokenRepositoryMock.Verify(x => x.AddAsync(
            It.Is<Domain.Entities.RefreshToken>(r => r.UserId == userId && r.TokenHash == "hashed_new_token"),
            It.IsAny<CancellationToken>()), Times.Once);

        // Verify transaction was committed
        _unitOfWorkMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenRefreshTokenNotFound()
    {
        // Arrange
        var rawToken = "non_existent_token";
        var tokenHash = "hashed_non_existent";

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Domain.Entities.RefreshToken?)null);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Token làm mới không hợp lệ hoặc đã hết hạn.");
    }

    [Fact]
    public async Task Handle_ShouldDetectTokenReuseAndRevokeAllSessions_WhenTokenAlreadyRevoked()
    {
        // Arrange
        var rawToken = "already_revoked_token";
        var tokenHash = "hashed_revoked";
        var userId = Guid.NewGuid();

        var revokedToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(2),
            RevokedAt = DateTime.UtcNow.AddMinutes(-10),
            RevokeReason = "ROTATED"
        };

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(revokedToken);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Token làm mới không hợp lệ hoặc đã hết hạn.");

        // Verify all active sessions were revoked due to reuse
        _refreshTokenRepositoryMock.Verify(x => x.RevokeAllByUserIdAsync(
            userId, "TOKEN_REUSE_DETECTED", It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldDetectTokenReuseAndRevokeAllSessions_WhenTokenAlreadyReplaced()
    {
        // Arrange
        var rawToken = "already_replaced_token";
        var tokenHash = "hashed_replaced";
        var userId = Guid.NewGuid();

        var replacedToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(2),
            RevokedAt = null,
            ReplacedByTokenId = Guid.NewGuid()
        };

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(replacedToken);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Token làm mới không hợp lệ hoặc đã hết hạn.");

        _refreshTokenRepositoryMock.Verify(x => x.RevokeAllByUserIdAsync(
            userId, "TOKEN_REUSE_DETECTED", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenTokenIsExpired()
    {
        // Arrange
        var rawToken = "expired_token";
        var tokenHash = "hashed_expired";
        var userId = Guid.NewGuid();

        var expiredToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5),
            RevokedAt = null,
            ReplacedByTokenId = null
        };

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expiredToken);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Token làm mới không hợp lệ hoặc đã hết hạn.");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenUserDoesNotExist()
    {
        // Arrange
        var rawToken = "valid_token_ghost_user";
        var tokenHash = "hashed_ghost";
        var userId = Guid.NewGuid();

        var validToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(validToken);
        _userRepositoryMock.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Token làm mới không hợp lệ hoặc đã hết hạn.");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenUserIsSuspendedOrLocked()
    {
        // Arrange
        var rawToken = "token_suspended_user";
        var tokenHash = "hashed_suspended";
        var userId = Guid.NewGuid();

        var validToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };

        var suspendedUser = CreateActiveUser(userId);
        suspendedUser.Status = "SUSPENDED";

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(validToken);
        _userRepositoryMock.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(suspendedUser);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenUserIsPending()
    {
        // Arrange
        var rawToken = "token_pending_user";
        var tokenHash = "hashed_pending";
        var userId = Guid.NewGuid();

        var validToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };

        var pendingUser = CreateActiveUser(userId);
        pendingUser.Status = "PENDING";

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(validToken);
        _userRepositoryMock.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingUser);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Tài khoản chưa được kích hoạt.");
    }

    [Fact]
    public async Task Handle_ShouldThrowForbiddenException_WhenAffiliateIsRejected()
    {
        // Arrange
        var rawToken = "token_rejected_affiliate";
        var tokenHash = "hashed_affiliate_rejected";
        var userId = Guid.NewGuid();

        var validToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };

        var user = CreateActiveUser(userId);
        user.AffiliateApplicationUser = new AffiliateApplication
        {
            Status = "REJECTED"
        };

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(validToken);
        _userRepositoryMock.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Your registration was rejected.");
    }

    [Fact]
    public async Task Handle_ShouldThrowForbiddenException_WhenClientIsRejected()
    {
        // Arrange
        var rawToken = "token_rejected_client";
        var tokenHash = "hashed_client_rejected";
        var userId = Guid.NewGuid();

        var validToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };

        var company = new Company
        {
            VerificationStatus = "REJECTED"
        };

        var user = CreateActiveUser(userId);
        user.CompanyUsers.Add(new CompanyUser
        {
            Company = company
        });

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(validToken);
        _userRepositoryMock.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Your registration was rejected.");
    }

    [Fact]
    public async Task Handle_ShouldThrowForbiddenException_WhenUserHasNoActiveRoles()
    {
        // Arrange
        var rawToken = "token_no_roles";
        var tokenHash = "hashed_no_roles";
        var userId = Guid.NewGuid();

        var validToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };

        var user = new AppUser
        {
            UserId = userId,
            Email = "noroles@hrconnect.vn",
            Status = "ACTIVE",
            EmailVerifiedAt = DateTime.UtcNow
        }; // No UserRoleUsers added

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(validToken);
        _userRepositoryMock.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Tài khoản chưa được phân quyền truy cập hệ thống.");
    }

    [Fact]
    public async Task Handle_ShouldRollbackTransactionAndThrow_WhenExceptionOccursDuringRotation()
    {
        // Arrange
        var rawToken = "token_will_fail_save";
        var tokenHash = "hashed_fail_save";
        var userId = Guid.NewGuid();

        var validToken = new Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };

        var user = CreateActiveUser(userId);

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _otpServiceMock.Setup(x => x.HashOtp("new_token")).Returns("hashed_new_token");
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(validToken);
        _userRepositoryMock.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _jwtTokenGeneratorMock.Setup(x => x.GenerateAccessToken(user, It.IsAny<IEnumerable<string>>(), It.IsAny<IEnumerable<string>>()))
            .Returns(("token", DateTime.UtcNow.AddHours(1)));
        _jwtTokenGeneratorMock.Setup(x => x.GenerateRefreshToken()).Returns("new_token");

        _unitOfWorkMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Database connection failure"));

        var command = new RefreshTokenCommand(rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Database connection failure");

        _unitOfWorkMock.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
