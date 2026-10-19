using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Users.Commands.DeleteAvatar;

public sealed class DeleteAvatarCommandHandler : IRequestHandler<DeleteAvatarCommand, DeleteAvatarResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IStorageCleanupJobRepository _cleanupRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DeleteAvatarCommandHandler> _logger;

    public DeleteAvatarCommandHandler(
        IUserRepository userRepository,
        IStorageCleanupJobRepository cleanupRepository,
        IUnitOfWork unitOfWork,
        ILogger<DeleteAvatarCommandHandler> logger)
    {
        _userRepository = userRepository;
        _cleanupRepository = cleanupRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<DeleteAvatarResponse> Handle(DeleteAvatarCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null)
            throw new NotFoundException("Không tìm thấy thông tin tài khoản người dùng tương ứng.");
        if (!string.Equals(user.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenException("Tài khoản của bạn đang bị khóa hoặc không hoạt động.");

        var now = DateTime.UtcNow;
        var oldObjectKey = GetOwnedAvatarKey(user);
        var hadAvatar = !string.IsNullOrWhiteSpace(user.AvatarObjectKey) || !string.IsNullOrWhiteSpace(user.AvatarUrl);
        if (hadAvatar)
        {
            await _unitOfWork.BeginTransactionAsync(cancellationToken);
            user.AvatarObjectKey = null;
            user.AvatarUrl = null;
            user.AvatarUpdatedAt = now;
            user.UpdatedAt = now;
            _userRepository.Update(user);

            if (!string.IsNullOrWhiteSpace(oldObjectKey))
            {
                await _cleanupRepository.AddAsync(new StorageCleanupJob
                {
                    StorageCleanupJobId = Guid.NewGuid(), UserId = user.UserId, ObjectKey = oldObjectKey,
                    Reason = "AVATAR_DELETED", Status = "PENDING", NextAttemptAt = now,
                    CreatedAt = now, UpdatedAt = now
                }, cancellationToken);
            }
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }

        _logger.LogInformation("Avatar cleared for user {UserId}; storage cleanup queued: {CleanupQueued}",
            user.UserId, oldObjectKey is not null);
        return new DeleteAvatarResponse
        {
            Message = hadAvatar ? "Xóa ảnh đại diện thành công." : "Tài khoản hiện chưa có ảnh đại diện.",
            Data = new DeleteAvatarData { UserId = user.UserId, AvatarUrl = null, UpdatedAt = now }
        };
    }

    private static string? GetOwnedAvatarKey(AppUser user)
    {
        var key = user.AvatarObjectKey;
        if (string.IsNullOrWhiteSpace(key) && user.AvatarUrl?.StartsWith($"avatars/{user.UserId:D}/", StringComparison.OrdinalIgnoreCase) == true)
            key = user.AvatarUrl;
        return key?.StartsWith($"avatars/{user.UserId:D}/", StringComparison.OrdinalIgnoreCase) == true ? key : null;
    }
}
