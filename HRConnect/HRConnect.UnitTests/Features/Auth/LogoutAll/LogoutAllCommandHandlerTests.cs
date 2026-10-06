using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.LogoutAll;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.LogoutAll;

public class LogoutAllCommandHandlerTests
{
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepositoryMock;
    private readonly Mock<ICurrentUserService> _currentUserServiceMock;
    private readonly Mock<IAuditLogService> _auditLogServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<LogoutAllCommandHandler>> _loggerMock;

    private readonly LogoutAllCommandHandler _handler;

    public LogoutAllCommandHandlerTests()
    {
        _refreshTokenRepositoryMock = new Mock<IRefreshTokenRepository>();
        _currentUserServiceMock = new Mock<ICurrentUserService>();
        _auditLogServiceMock = new Mock<IAuditLogService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<LogoutAllCommandHandler>>();

        _handler = new LogoutAllCommandHandler(
            _refreshTokenRepositoryMock.Object,
            _currentUserServiceMock.Object,
            _auditLogServiceMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldRevokeAllActiveTokensAndCommit_WhenUserIsAuthenticated()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var command = new LogoutAllCommand { UserId = userId };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Message.Should().Be("Đăng xuất khỏi tất cả thiết bị thành công.");

        _refreshTokenRepositoryMock.Verify(
            x => x.RevokeAllByUserIdAsync(userId, "LOGOUT_ALL", It.IsAny<CancellationToken>()),
            Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

        // Audit ALL_SESSIONS_REVOKED recorded
        _auditLogServiceMock.Verify(x => x.AddAsync(
            It.Is<AuditEntry>(a =>
                a.Action == AuditActions.AllSessionsRevoked &&
                a.EntityType == "APP_USER" &&
                a.EntityId == userId &&
                a.ActorUserId == userId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorizedException_WhenUserIsNotAuthenticated()
    {
        // Arrange
        _currentUserServiceMock.Setup(x => x.UserId).Returns((Guid?)null);
        var command = new LogoutAllCommand { UserId = null };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("Bạn chưa đăng nhập hoặc phiên đăng nhập không hợp lệ.");

        _refreshTokenRepositoryMock.Verify(
            x => x.RevokeAllByUserIdAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);

        // No audit when unauthenticated
        _auditLogServiceMock.Verify(x => x.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldSucceedIdempotently_WhenUserHasNoActiveSessions()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var command = new LogoutAllCommand { UserId = userId };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Message.Should().Be("Đăng xuất khỏi tất cả thiết bị thành công.");

        _refreshTokenRepositoryMock.Verify(
            x => x.RevokeAllByUserIdAsync(userId, "LOGOUT_ALL", It.IsAny<CancellationToken>()),
            Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

        // Audit is still recorded (user intent to logout all)
        _auditLogServiceMock.Verify(x => x.AddAsync(
            It.Is<AuditEntry>(a => a.Action == AuditActions.AllSessionsRevoked),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldUseCurrentUserService_WhenRequestUserIdIsNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _currentUserServiceMock.Setup(x => x.UserId).Returns(userId);
        var command = new LogoutAllCommand { UserId = null };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Message.Should().Be("Đăng xuất khỏi tất cả thiết bị thành công.");

        _refreshTokenRepositoryMock.Verify(
            x => x.RevokeAllByUserIdAsync(userId, "LOGOUT_ALL", It.IsAny<CancellationToken>()),
            Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

        // Audit recorded
        _auditLogServiceMock.Verify(x => x.AddAsync(
            It.Is<AuditEntry>(a => a.Action == AuditActions.AllSessionsRevoked && a.ActorUserId == userId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldOnlyRevokeForCurrentUser_AndNotAffectOtherUsers()
    {
        // Arrange
        var currentUserId = Guid.NewGuid();
        var anotherUserId = Guid.NewGuid();
        var command = new LogoutAllCommand { UserId = currentUserId };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();

        _refreshTokenRepositoryMock.Verify(
            x => x.RevokeAllByUserIdAsync(currentUserId, "LOGOUT_ALL", It.IsAny<CancellationToken>()),
            Times.Once);
        _refreshTokenRepositoryMock.Verify(
            x => x.RevokeAllByUserIdAsync(anotherUserId, It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
