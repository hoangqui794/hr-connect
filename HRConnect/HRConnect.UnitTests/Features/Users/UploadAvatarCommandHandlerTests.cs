using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Users.Commands.UploadAvatar;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Users;

public class UploadAvatarCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IFileStorageService> _fileStorageServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<UploadAvatarCommandHandler>> _loggerMock;
    private readonly R2Settings _r2Settings;
    private readonly UploadAvatarCommandHandler _handler;

    public UploadAvatarCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _fileStorageServiceMock = new Mock<IFileStorageService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<UploadAvatarCommandHandler>>();

        _r2Settings = new R2Settings
        {
            BucketName = "hrconnect-candidate-cvs",
            Endpoint = "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com",
            PublicBaseUrl = "https://cdn.hrconnect.vn"
        };

        _handler = new UploadAvatarCommandHandler(
            _userRepositoryMock.Object,
            _fileStorageServiceMock.Object,
            _unitOfWorkMock.Object,
            Options.Create(_r2Settings),
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenValidRequest_ShouldUploadToR2AndUpdateUserSuccessfully()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var existingUser = new AppUser
        {
            UserId = userId,
            Email = "user.test@example.com",
            DisplayName = "Test User",
            AvatarUrl = "avatars/old-user/old-avatar.jpg",
            Status = "ACTIVE"
        };

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        _fileStorageServiceMock
            .Setup(f => f.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Stream s, string key, string ct, CancellationToken ct2) => key);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        using var memoryStream = new MemoryStream(new byte[] { 0xFF, 0xD8, 0xFF });
        var command = new UploadAvatarCommand
        {
            UserId = userId,
            FileStream = memoryStream,
            FileName = "my-avatar.png",
            ContentType = "image/png",
            FileSizeBytes = 1024
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Tải lên ảnh đại diện thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.UserId.Should().Be(userId);
        result.Data.AvatarUrl.Should().StartWith("https://cdn.hrconnect.vn/avatars/");
        result.Data.AvatarUrl.Should().EndWith(".png");
        result.Data.ObjectKey.Should().StartWith($"avatars/{userId}/");

        _fileStorageServiceMock.Verify(f => f.UploadAsync(
            memoryStream,
            It.Is<string>(k => k.StartsWith($"avatars/{userId}/") && k.EndsWith(".png")),
            "image/png",
            It.IsAny<CancellationToken>()), Times.Once);

        // Should clean up old avatar
        _fileStorageServiceMock.Verify(f => f.DeleteAsync("avatars/old-user/old-avatar.jpg", It.IsAny<CancellationToken>()), Times.Once);

        _userRepositoryMock.Verify(r => r.Update(existingUser), Times.Once);
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

        using var memoryStream = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadAvatarCommand
        {
            UserId = userId,
            FileStream = memoryStream,
            FileName = "avatar.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 100
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin tài khoản người dùng*");

        _fileStorageServiceMock.Verify(f => f.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenUserNotActive_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var existingUser = new AppUser
        {
            UserId = userId,
            Email = "locked@example.com",
            Status = "SUSPENDED"
        };

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        using var memoryStream = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadAvatarCommand
        {
            UserId = userId,
            FileStream = memoryStream,
            FileName = "avatar.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 100
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Tài khoản của bạn đang bị khóa hoặc không hoạt động*");

        _fileStorageServiceMock.Verify(f => f.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenR2UploadFails_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var existingUser = new AppUser
        {
            UserId = userId,
            Email = "user@example.com",
            Status = "ACTIVE"
        };

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        _fileStorageServiceMock
            .Setup(f => f.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("R2 network error"));

        using var memoryStream = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadAvatarCommand
        {
            UserId = userId,
            FileStream = memoryStream,
            FileName = "avatar.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 100
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Không thể lưu trữ ảnh đại diện lên hệ thống lưu trữ đám mây*");

        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
