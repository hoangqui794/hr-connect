using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Auth.Commands.ChangePassword;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.ChangePassword;

public class ChangePasswordCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepositoryMock;
    private readonly Mock<IPasswordHasher> _passwordHasherMock;
    private readonly Mock<ICurrentUserService> _currentUserServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<ChangePasswordCommandHandler>> _loggerMock;

    private readonly ChangePasswordCommandHandler _handler;

    public ChangePasswordCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _refreshTokenRepositoryMock = new Mock<IRefreshTokenRepository>();
        _passwordHasherMock = new Mock<IPasswordHasher>();
        _currentUserServiceMock = new Mock<ICurrentUserService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<ChangePasswordCommandHandler>>();

        _handler = new ChangePasswordCommandHandler(
            _userRepositoryMock.Object,
            _refreshTokenRepositoryMock.Object,
            _passwordHasherMock.Object,
            _currentUserServiceMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorizedException_WhenUserIsNotAuthenticated()
    {
        // Arrange
        var command = new ChangePasswordCommand("OldPassword@123", "NewPassword@123");
        _currentUserServiceMock.Setup(x => x.UserId).Returns((Guid?)null);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("User is not authenticated.");
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFoundException_WhenUserDoesNotExist()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var command = new ChangePasswordCommand("OldPassword@123", "NewPassword@123")
        {
            UserId = userId
        };

        _userRepositoryMock
            .Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("User not found.");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenUserIsGoogleOnly()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = new AppUser
        {
            UserId = userId,
            Email = "google@example.com",
            PasswordHash = "GOOGLE_OAUTH_TOKEN",
            Status = "ACTIVE"
        };
        var command = new ChangePasswordCommand("OldPassword@123", "NewPassword@123")
        {
            UserId = userId
        };

        _userRepositoryMock
            .Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Password change is not available for this account.");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenCurrentPasswordIsIncorrect()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = new AppUser
        {
            UserId = userId,
            Email = "user@example.com",
            PasswordHash = "$2a$12$hashedcurrentpassword",
            Status = "ACTIVE"
        };
        var command = new ChangePasswordCommand("WrongOldPassword@123", "NewPassword@123")
        {
            UserId = userId
        };

        _userRepositoryMock
            .Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _passwordHasherMock
            .Setup(x => x.Verify("WrongOldPassword@123", user.PasswordHash))
            .Returns(false);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Current password is incorrect.");
    }

    [Fact]
    public async Task Handle_ShouldThrowBadRequestException_WhenNewPasswordIsSameAsCurrentPassword()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = new AppUser
        {
            UserId = userId,
            Email = "user@example.com",
            PasswordHash = "$2a$12$hashedcurrentpassword",
            Status = "ACTIVE"
        };
        var command = new ChangePasswordCommand("OldPassword@123", "OldPassword@123")
        {
            UserId = userId
        };

        _userRepositoryMock
            .Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _passwordHasherMock
            .Setup(x => x.Verify("OldPassword@123", user.PasswordHash))
            .Returns(true); // Current password matches

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("New password must be different from the current password.");
    }

    [Fact]
    public async Task Handle_ShouldSuccessfullyChangePassword_WhenCurrentPasswordIsCorrect()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = new AppUser
        {
            UserId = userId,
            Email = "user@example.com",
            PasswordHash = "$2a$12$oldhash123456",
            Status = "ACTIVE"
        };
        var command = new ChangePasswordCommand("OldPassword@123", "NewPassword@123")
        {
            UserId = userId
        };

        _userRepositoryMock
            .Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _passwordHasherMock
            .Setup(x => x.Verify("OldPassword@123", "$2a$12$oldhash123456"))
            .Returns(true);

        _passwordHasherMock
            .Setup(x => x.Verify("NewPassword@123", "$2a$12$oldhash123456"))
            .Returns(false);

        _passwordHasherMock
            .Setup(x => x.Hash("NewPassword@123"))
            .Returns("$2a$12$brandnewhash999");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Password changed successfully.");

        user.PasswordHash.Should().Be("$2a$12$brandnewhash999");
        _userRepositoryMock.Verify(x => x.Update(user), Times.Once);

        // Sessions/refresh tokens revoked
        _refreshTokenRepositoryMock.Verify(x => x.RevokeAllByUserIdAsync(userId, "PASSWORD_CHANGE", It.IsAny<CancellationToken>()), Times.Once);

        // Transaction lifecycle verified
        _unitOfWorkMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
