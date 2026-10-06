using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Admin.Commands.UpdateAdminProfile;

public class UpdateAdminProfileCommandHandler : IRequestHandler<UpdateAdminProfileCommand, UpdateAdminProfileResponse>
{
    private readonly IAdminProfileRepository _adminProfileRepository;
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly ILogger<UpdateAdminProfileCommandHandler> _logger;

    public UpdateAdminProfileCommandHandler(
        IAdminProfileRepository adminProfileRepository,
        IUserRepository userRepository,
        IUnitOfWork unitOfWork,
        IPhoneNormalizer phoneNormalizer,
        ILogger<UpdateAdminProfileCommandHandler> logger)
    {
        _adminProfileRepository = adminProfileRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _phoneNormalizer = phoneNormalizer;
        _logger = logger;
    }

    public async Task<UpdateAdminProfileResponse> Handle(
        UpdateAdminProfileCommand request,
        CancellationToken cancellationToken)
    {
        var profile = await _adminProfileRepository.GetByUserIdWithDetailsAsync(request.UserId, cancellationToken);
        if (profile == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ quản trị viên để cập nhật cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ quản trị viên tương ứng với tài khoản này.");
        }

        if (!string.Equals(profile.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Tài khoản quản trị viên UserId {UserId} đang ở trạng thái không hoạt động ({Status})", request.UserId, profile.Status);
            throw new ForbiddenException("Tài khoản quản trị viên của bạn đang bị khóa hoặc không hoạt động.");
        }

        var now = DateTime.UtcNow;
        var cleanDisplayName = request.DisplayName.Trim();
        var cleanPhone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        var normalizedPhone = _phoneNormalizer.Normalize(cleanPhone);
        var cleanJobTitle = string.IsNullOrWhiteSpace(request.JobTitle) ? null : request.JobTitle.Trim();

        profile.JobTitle = cleanJobTitle;
        profile.UpdatedAt = now;

        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user != null)
        {
            user.DisplayName = cleanDisplayName;
            user.Phone = cleanPhone;
            user.NormalizedPhone = normalizedPhone;
            user.UpdatedAt = now;
            _userRepository.Update(user);
        }

        _adminProfileRepository.Update(profile);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Cập nhật hồ sơ quản trị viên thành công cho UserId {UserId}", request.UserId);

        return new UpdateAdminProfileResponse
        {
            Success = true,
            Message = "Cập nhật hồ sơ quản trị viên thành công.",
            Data = new UpdateAdminProfileData
            {
                AdminProfileId = profile.AdminProfileId,
                UserId = profile.UserId,
                Email = user?.Email ?? profile.User?.Email ?? string.Empty,
                DisplayName = user?.DisplayName ?? cleanDisplayName,
                Phone = user?.Phone ?? cleanPhone,
                AvatarUrl = user?.AvatarUrl ?? profile.User?.AvatarUrl,
                EmployeeCode = profile.EmployeeCode,
                JobTitle = profile.JobTitle,
                Status = profile.Status,
                CreatedAt = profile.CreatedAt,
                UpdatedAt = profile.UpdatedAt
            }
        };
    }
}
