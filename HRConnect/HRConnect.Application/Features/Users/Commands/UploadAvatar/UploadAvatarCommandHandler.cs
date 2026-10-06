using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Users.Commands.UploadAvatar;

public class UploadAvatarCommandHandler : IRequestHandler<UploadAvatarCommand, UploadAvatarResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IFileStorageService _fileStorageService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly R2Settings _r2Settings;
    private readonly ILogger<UploadAvatarCommandHandler> _logger;

    public UploadAvatarCommandHandler(
        IUserRepository userRepository,
        IFileStorageService fileStorageService,
        IUnitOfWork unitOfWork,
        IOptions<R2Settings> r2Options,
        ILogger<UploadAvatarCommandHandler> logger)
    {
        _userRepository = userRepository;
        _fileStorageService = fileStorageService;
        _unitOfWork = unitOfWork;
        _r2Settings = r2Options.Value;
        _logger = logger;
    }

    public async Task<UploadAvatarResponse> Handle(UploadAvatarCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("Không tìm thấy người dùng với UserId {UserId} để cập nhật avatar", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin tài khoản người dùng tương ứng.");
        }

        if (!string.Equals(user.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Tài khoản UserId {UserId} đang ở trạng thái không hoạt động ({Status})", request.UserId, user.Status);
            throw new ForbiddenException("Tài khoản của bạn đang bị khóa hoặc không hoạt động.");
        }

        var ext = Path.GetExtension(request.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext))
        {
            ext = ".jpg";
        }

        var avatarId = Guid.NewGuid();
        var objectKey = $"avatars/{user.UserId}/{avatarId}{ext}";

        // Upload to Cloudflare R2
        string uploadedKey;
        try
        {
            uploadedKey = await _fileStorageService.UploadAsync(
                request.FileStream,
                objectKey,
                request.ContentType,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi upload avatar lên R2 cho UserId {UserId}", user.UserId);
            throw new InvalidOperationException("Không thể lưu trữ ảnh đại diện lên hệ thống lưu trữ đám mây.", ex);
        }

        // Determine accessible avatar URL
        string avatarUrl;
        if (!string.IsNullOrWhiteSpace(_r2Settings.PublicBaseUrl))
        {
            avatarUrl = $"{_r2Settings.PublicBaseUrl.TrimEnd('/')}/{uploadedKey}";
        }
        else
        {
            try
            {
                avatarUrl = await _fileStorageService.GetPresignedDownloadUrlAsync(
                    uploadedKey,
                    TimeSpan.FromDays(7),
                    cancellationToken);
            }
            catch
            {
                avatarUrl = uploadedKey;
            }
        }

        // Clean up previous avatar if it was stored in R2
        var oldAvatarKey = user.AvatarUrl;
        if (!string.IsNullOrWhiteSpace(oldAvatarKey) && oldAvatarKey.StartsWith("avatars/", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await _fileStorageService.DeleteAsync(oldAvatarKey, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không thể xóa avatar cũ ({OldKey}) trên R2", oldAvatarKey);
            }
        }

        var now = DateTime.UtcNow;
        user.AvatarUrl = avatarUrl;
        user.UpdatedAt = now;

        _userRepository.Update(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Người dùng {UserId} đã cập nhật avatar thành công. ObjectKey: {ObjectKey}", user.UserId, uploadedKey);

        return new UploadAvatarResponse
        {
            Success = true,
            Message = "Tải lên ảnh đại diện thành công.",
            Data = new UploadAvatarData
            {
                UserId = user.UserId,
                AvatarUrl = avatarUrl,
                ObjectKey = uploadedKey,
                UpdatedAt = now
            }
        };
    }
}
