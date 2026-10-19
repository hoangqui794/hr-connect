using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Users.Commands.UploadAvatar;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Users;

public sealed class UploadAvatarCommandHandlerTests
{
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IStorageCleanupJobRepository> _cleanup = new();
    private readonly Mock<IFileStorageService> _storage = new();
    private readonly Mock<IAvatarImageProcessor> _processor = new();
    private readonly Mock<IAvatarUrlResolver> _resolver = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly UploadAvatarCommandHandler _handler;

    public UploadAvatarCommandHandlerTests()
    {
        _processor.Setup(x => x.ProcessAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ProcessedAvatarImage([1, 2, 3], "image/webp", ".webp", 100, 100));
        _storage.Setup(x => x.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), "image/webp", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Stream _, string key, string _, CancellationToken _) => key);
        _resolver.Setup(x => x.Resolve(It.IsAny<AppUser>()))
            .Returns((AppUser user) => $"/api/v1/users/{user.UserId:D}/avatar?v={user.AvatarUpdatedAt!.Value.Ticks}");
        _handler = new UploadAvatarCommandHandler(_users.Object, _cleanup.Object, _storage.Object,
            _processor.Object, _resolver.Object, _unitOfWork.Object, Mock.Of<ILogger<UploadAvatarCommandHandler>>());
    }

    [Fact]
    public async Task Handle_ValidReplacement_CommitsNewKeyAndQueuesOldObject()
    {
        var user = ActiveUser();
        user.AvatarObjectKey = $"avatars/{user.UserId:D}/old.webp";
        _users.Setup(x => x.GetByIdAsync(user.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var result = await _handler.Handle(Command(user.UserId), CancellationToken.None);

        result.Data!.AvatarUrl.Should().StartWith($"/api/v1/users/{user.UserId:D}/avatar?v=");
        result.Data.UpdatedAt.Should().Be(user.AvatarUpdatedAt!.Value);
        user.AvatarObjectKey.Should().StartWith($"avatars/{user.UserId:D}/").And.EndWith(".webp");
        user.AvatarUrl.Should().BeNull();
        _cleanup.Verify(x => x.AddAsync(It.Is<StorageCleanupJob>(job =>
            job.ObjectKey.EndsWith("old.webp") && job.Reason == "AVATAR_REPLACED"), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _storage.Verify(x => x.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_DatabaseCommitFails_DeletesNewObjectAsCompensation()
    {
        var user = ActiveUser();
        _users.Setup(x => x.GetByIdAsync(user.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _unitOfWork.Setup(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("database unavailable"));

        var action = () => _handler.Handle(Command(user.UserId), CancellationToken.None);

        await action.Should().ThrowAsync<InvalidOperationException>().WithMessage("database unavailable");
        _storage.Verify(x => x.DeleteAsync(It.Is<string>(key => key.StartsWith($"avatars/{user.UserId:D}/")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_StorageUploadFails_DoesNotStartDatabaseTransaction()
    {
        var user = ActiveUser();
        _users.Setup(x => x.GetByIdAsync(user.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _storage.Setup(x => x.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new IOException("R2 unavailable"));

        var action = () => _handler.Handle(Command(user.UserId), CancellationToken.None);

        await action.Should().ThrowAsync<InvalidOperationException>().WithMessage("*tạm thời gián đoạn*");
        _unitOfWork.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_UserNotFound_StopsBeforeProcessing()
    {
        var userId = Guid.NewGuid();
        _users.Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync((AppUser?)null);

        var action = () => _handler.Handle(Command(userId), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
        _processor.Verify(x => x.ProcessAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_InactiveUser_StopsBeforeProcessing()
    {
        var user = ActiveUser();
        user.Status = "SUSPENDED";
        _users.Setup(x => x.GetByIdAsync(user.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var action = () => _handler.Handle(Command(user.UserId), CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
        _processor.Verify(x => x.ProcessAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static AppUser ActiveUser() => new()
    {
        UserId = Guid.NewGuid(), Email = "avatar@example.com", PasswordHash = "hash", Status = "ACTIVE"
    };

    private static UploadAvatarCommand Command(Guid userId) => new()
    {
        UserId = userId, FileName = "avatar.png", ContentType = "image/png", FileSizeBytes = 3,
        FileStream = new MemoryStream([1, 2, 3])
    };
}
