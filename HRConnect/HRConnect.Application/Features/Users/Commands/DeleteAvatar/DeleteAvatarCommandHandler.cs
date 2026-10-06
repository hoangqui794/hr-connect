using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Users.Commands.DeleteAvatar;

public class DeleteAvatarCommandHandler : IRequestHandler<DeleteAvatarCommand, DeleteAvatarResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IFileStorageService _fileStorageService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DeleteAvatarCommandHandler> _logger;

    public DeleteAvatarCommandHandler(
        IUserRepository userRepository,
        IFileStorageService fileStorageService,
        IUnitOfWork unitOfWork,
        ILogger<DeleteAvatarCommandHandler> logger)
    {
        _userRepository = userRepository;
        _fileStorageService = fileStorageService;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<DeleteAvatarResponse> Handle(DeleteAvatarCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("Không tìm thấy người dùng với UserId {UserId} để xóa avatar", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin tài khoản người dùng tương ứng.");
        }

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

        user.AvatarUrl = null;
        user.UpdatedAt = DateTime.UtcNow;

        _userRepository.Update(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Người dùng {UserId} đã xóa ảnh đại diện thành công", user.UserId);

        return new DeleteAvatarResponse
        {
            Success = true,
            Message = "Xóa ảnh đại diện thành công."
        };
    }
}
