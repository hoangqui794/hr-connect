using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Users.Commands.UploadAvatar;

public sealed class UploadAvatarCommandHandler : IRequestHandler<UploadAvatarCommand, UploadAvatarResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IStorageCleanupJobRepository _cleanupRepository;
    private readonly IFileStorageService _fileStorageService;
    private readonly IAvatarImageProcessor _imageProcessor;
    private readonly IAvatarUrlResolver _urlResolver;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<UploadAvatarCommandHandler> _logger;

    public UploadAvatarCommandHandler(
        IUserRepository userRepository,
        IStorageCleanupJobRepository cleanupRepository,
        IFileStorageService fileStorageService,
        IAvatarImageProcessor imageProcessor,
        IAvatarUrlResolver urlResolver,
        IUnitOfWork unitOfWork,
        ILogger<UploadAvatarCommandHandler> logger)
    {
        _userRepository = userRepository;
        _cleanupRepository = cleanupRepository;
        _fileStorageService = fileStorageService;
        _imageProcessor = imageProcessor;
        _urlResolver = urlResolver;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<UploadAvatarResponse> Handle(UploadAvatarCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null)
            throw new NotFoundException("Không tìm thấy thông tin tài khoản người dùng tương ứng.");
        if (!string.Equals(user.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenException("Tài khoản của bạn đang bị khóa hoặc không hoạt động.");

        ProcessedAvatarImage processed;
        try
        {
            processed = await _imageProcessor.ProcessAsync(request.FileStream, cancellationToken);
        }
        catch (NotSupportedException ex)
        {
            throw new BadRequestException(ex.Message, "AVATAR_UNSUPPORTED_MEDIA_TYPE");
        }
        catch (InvalidDataException ex)
        {
            throw new BadRequestException(ex.Message, "AVATAR_INVALID_IMAGE");
        }

        var objectKey = $"avatars/{user.UserId:D}/{Guid.NewGuid():N}{processed.Extension}";
        string uploadedKey;
        try
        {
            await using var normalizedStream = processed.OpenReadStream();
            uploadedKey = await _fileStorageService.UploadAsync(
                normalizedStream, objectKey, processed.ContentType, cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "Avatar upload to object storage failed for user {UserId}", user.UserId);
            throw new InvalidOperationException("Hệ thống lưu trữ ảnh đang tạm thời gián đoạn. Vui lòng thử lại sau.", ex);
        }

        var now = DateTime.UtcNow;
        var oldObjectKey = GetOwnedAvatarKey(user);
        try
        {
            await _unitOfWork.BeginTransactionAsync(cancellationToken);
            user.AvatarObjectKey = uploadedKey;
            user.AvatarUpdatedAt = now;
            user.AvatarUrl = null;
            user.UpdatedAt = now;
            _userRepository.Update(user);

            if (!string.IsNullOrWhiteSpace(oldObjectKey) && !string.Equals(oldObjectKey, uploadedKey, StringComparison.Ordinal))
                await _cleanupRepository.AddAsync(CreateCleanupJob(user.UserId, oldObjectKey, "AVATAR_REPLACED", now), cancellationToken);

            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await CompensateUploadedObjectAsync(uploadedKey, cancellationToken);
            throw;
        }

        var avatarUrl = _urlResolver.Resolve(user)
            ?? throw new InvalidOperationException("Không thể tạo đường dẫn ảnh đại diện.");
        _logger.LogInformation("Avatar updated for user {UserId}", user.UserId);
        return new UploadAvatarResponse
        {
            Data = new UploadAvatarData { UserId = user.UserId, AvatarUrl = avatarUrl, UpdatedAt = now }
        };
    }

    private static string? GetOwnedAvatarKey(AppUser user)
    {
        var key = user.AvatarObjectKey;
        if (string.IsNullOrWhiteSpace(key) && user.AvatarUrl?.StartsWith($"avatars/{user.UserId:D}/", StringComparison.OrdinalIgnoreCase) == true)
            key = user.AvatarUrl;
        return key?.StartsWith($"avatars/{user.UserId:D}/", StringComparison.OrdinalIgnoreCase) == true ? key : null;
    }

    private static StorageCleanupJob CreateCleanupJob(Guid? userId, string objectKey, string reason, DateTime now) => new()
    {
        StorageCleanupJobId = Guid.NewGuid(), UserId = userId, ObjectKey = objectKey, Reason = reason,
        Status = "PENDING", NextAttemptAt = now, CreatedAt = now, UpdatedAt = now
    };

    private async Task CompensateUploadedObjectAsync(string uploadedKey, CancellationToken cancellationToken)
    {
        try
        {
            await _fileStorageService.DeleteAsync(uploadedKey, cancellationToken.IsCancellationRequested ? CancellationToken.None : cancellationToken);
        }
        catch (Exception deleteException)
        {
            _logger.LogError(deleteException, "Could not compensate uploaded avatar object; recovery queued");
            try
            {
                var now = DateTime.UtcNow;
                await _cleanupRepository.AddAsync(CreateCleanupJob(null, uploadedKey, "UPLOAD_COMPENSATION", now), CancellationToken.None);
                await _unitOfWork.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception queueException)
            {
                _logger.LogCritical(queueException, "Could not queue avatar object compensation");
            }
        }
    }
}
