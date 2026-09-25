using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Users.Commands.DeleteAvatar;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Users;

public class DeleteAvatarCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IFileStorageService> _fileStorageServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<DeleteAvatarCommandHandler>> _loggerMock;
    private readonly DeleteAvatarCommandHandler _handler;

    public DeleteAvatarCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _fileStorageServiceMock = new Mock<IFileStorageService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<DeleteAvatarCommandHandler>>();

        _handler = new DeleteAvatarCommandHandler(
            _userRepositoryMock.Object,
            _fileStorageServiceMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenValidUserWithR2Avatar_ShouldDeleteFromR2AndClearAvatarUrl()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = new AppUser
        {
            UserId = userId,
            Email = "avatar.user@example.com",
            AvatarUrl = "avatars/123/my-avatar.png",
            Status = "ACTIVE"
        };

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new DeleteAvatarCommand { UserId = userId };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Xóa ảnh đại diện thành công.");
        user.AvatarUrl.Should().BeNull();

        _fileStorageServiceMock.Verify(f => f.DeleteAsync("avatars/123/my-avatar.png", It.IsAny<CancellationToken>()), Times.Once);
        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenUserNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        var command = new DeleteAvatarCommand { UserId = userId };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin tài khoản người dùng*");

        _fileStorageServiceMock.Verify(f => f.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
