using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Users.Commands.DeleteAvatar;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Users;

public sealed class DeleteAvatarCommandHandlerTests
{
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IStorageCleanupJobRepository> _cleanup = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly DeleteAvatarCommandHandler _handler;

    public DeleteAvatarCommandHandlerTests()
    {
        _handler = new DeleteAvatarCommandHandler(_users.Object, _cleanup.Object, _unitOfWork.Object,
            Mock.Of<ILogger<DeleteAvatarCommandHandler>>());
    }

    [Fact]
    public async Task Handle_StoredAvatar_ClearsPointerAndQueuesCleanupInTransaction()
    {
        var user = ActiveUser();
        user.AvatarObjectKey = $"avatars/{user.UserId:D}/avatar.webp";
        user.AvatarUrl = "https://legacy.example/avatar.jpg";
        _users.Setup(x => x.GetByIdAsync(user.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var result = await _handler.Handle(new DeleteAvatarCommand { UserId = user.UserId }, CancellationToken.None);

        user.AvatarObjectKey.Should().BeNull();
        user.AvatarUrl.Should().BeNull();
        user.AvatarUpdatedAt.Should().NotBeNull();
        result.Data!.AvatarUrl.Should().BeNull();
        _cleanup.Verify(x => x.AddAsync(It.Is<StorageCleanupJob>(job =>
            job.ObjectKey.EndsWith("avatar.webp") && job.Reason == "AVATAR_DELETED"), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NoAvatar_IsIdempotentAndDoesNotWrite()
    {
        var user = ActiveUser();
        _users.Setup(x => x.GetByIdAsync(user.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var result = await _handler.Handle(new DeleteAvatarCommand { UserId = user.UserId }, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Contain("chưa có ảnh");
        _unitOfWork.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
        _cleanup.Verify(x => x.AddAsync(It.IsAny<StorageCleanupJob>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_LegacyExternalUrl_ClearsDatabaseWithoutQueuingForeignObject()
    {
        var user = ActiveUser();
        user.AvatarUrl = "https://images.example.com/avatar.png";
        _users.Setup(x => x.GetByIdAsync(user.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        await _handler.Handle(new DeleteAvatarCommand { UserId = user.UserId }, CancellationToken.None);

        user.AvatarUrl.Should().BeNull();
        _cleanup.Verify(x => x.AddAsync(It.IsAny<StorageCleanupJob>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_InactiveUser_IsForbidden()
    {
        var user = ActiveUser(); user.Status = "SUSPENDED";
        _users.Setup(x => x.GetByIdAsync(user.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var action = () => _handler.Handle(new DeleteAvatarCommand { UserId = user.UserId }, CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
        _unitOfWork.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_UserNotFound_ThrowsNotFound()
    {
        var userId = Guid.NewGuid();
        _users.Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync((AppUser?)null);
        Func<Task> action = () => _handler.Handle(new DeleteAvatarCommand { UserId = userId }, CancellationToken.None);
        await action.Should().ThrowAsync<NotFoundException>();
    }

    private static AppUser ActiveUser() => new()
    {
        UserId = Guid.NewGuid(), Email = "avatar@example.com", PasswordHash = "hash", Status = "ACTIVE"
    };
}
