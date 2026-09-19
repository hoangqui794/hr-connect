using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Auth.Commands.Logout;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.Logout;

public class LogoutCommandHandlerTests
{
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepositoryMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<ICurrentUserService> _currentUserServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<LogoutCommandHandler>> _loggerMock;

    private readonly LogoutCommandHandler _handler;

    public LogoutCommandHandlerTests()
    {
        _refreshTokenRepositoryMock = new Mock<IRefreshTokenRepository>();
        _otpServiceMock = new Mock<IOtpService>();
        _currentUserServiceMock = new Mock<ICurrentUserService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<LogoutCommandHandler>>();

        _handler = new LogoutCommandHandler(
            _refreshTokenRepositoryMock.Object,
            _otpServiceMock.Object,
            _currentUserServiceMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldSuccessfullyRevokeToken_WhenTokenIsValidAndBelongsToUser()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var rawToken = "sample_raw_refresh_token";
        var tokenHash = "hashed_refresh_token";

        var existingToken = new HRConnect.Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = null
        };

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingToken);

        var command = new LogoutCommand(rawToken) { UserId = userId };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Message.Should().Be("Đăng xuất thành công.");

        existingToken.RevokedAt.Should().NotBeNull();
        existingToken.RevokeReason.Should().Be("LOGOUT");

        _refreshTokenRepositoryMock.Verify(x => x.Update(existingToken), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorizedException_WhenUserIsNotAuthenticated()
    {
        // Arrange
        var rawToken = "sample_token";
        _currentUserServiceMock.Setup(x => x.UserId).Returns((Guid?)null);

        var command = new LogoutCommand(rawToken); // UserId is null

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("User is not authenticated.");

        _refreshTokenRepositoryMock.Verify(x => x.GetByHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldNotRevokeToken_WhenTokenBelongsToAnotherUser()
    {
        // Arrange
        var currentUserId = Guid.NewGuid();
        var victimUserId = Guid.NewGuid();
        var rawToken = "victim_raw_token";
        var tokenHash = "victim_hashed_token";

        var victimToken = new HRConnect.Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = victimUserId, // Different user
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(5),
            RevokedAt = null
        };

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(victimToken);

        var command = new LogoutCommand(rawToken) { UserId = currentUserId };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Message.Should().Be("Đăng xuất thành công.");

        // Verify victim's token was NOT modified or saved
        victimToken.RevokedAt.Should().BeNull();
        victimToken.RevokeReason.Should().BeNull();
        _refreshTokenRepositoryMock.Verify(x => x.Update(It.IsAny<HRConnect.Domain.Entities.RefreshToken>()), Times.Never);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldReturnSuccessWithoutUpdating_WhenTokenIsAlreadyRevoked()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var rawToken = "already_revoked_token";
        var tokenHash = "hashed_revoked_token";

        var alreadyRevokedToken = new HRConnect.Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(3),
            RevokedAt = DateTime.UtcNow.AddDays(-1),
            RevokeReason = "LOGOUT"
        };

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(alreadyRevokedToken);

        var command = new LogoutCommand(rawToken) { UserId = userId };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Message.Should().Be("Đăng xuất thành công.");

        _refreshTokenRepositoryMock.Verify(x => x.Update(It.IsAny<HRConnect.Domain.Entities.RefreshToken>()), Times.Never);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldReturnSuccess_WhenTokenDoesNotExistInStorage()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var rawToken = "ghost_token";
        var tokenHash = "hashed_ghost_token";

        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync((HRConnect.Domain.Entities.RefreshToken?)null);

        var command = new LogoutCommand(rawToken) { UserId = userId };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Message.Should().Be("Đăng xuất thành công.");

        _refreshTokenRepositoryMock.Verify(x => x.Update(It.IsAny<HRConnect.Domain.Entities.RefreshToken>()), Times.Never);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldUseCurrentUserService_WhenRequestUserIdIsNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var rawToken = "token_from_service";
        var tokenHash = "hashed_service_token";

        var existingToken = new HRConnect.Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = null
        };

        _currentUserServiceMock.Setup(x => x.UserId).Returns(userId);
        _otpServiceMock.Setup(x => x.HashOtp(rawToken)).Returns(tokenHash);
        _refreshTokenRepositoryMock.Setup(x => x.GetByHashAsync(tokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingToken);

        var command = new LogoutCommand(rawToken); // UserId left null

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        existingToken.RevokedAt.Should().NotBeNull();
        existingToken.RevokeReason.Should().Be("LOGOUT");

        _refreshTokenRepositoryMock.Verify(x => x.Update(existingToken), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
