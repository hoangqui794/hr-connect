using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.InternalHr.Commands.UpdateInternalHrProfile;

public class UpdateInternalHrProfileCommandHandler : IRequestHandler<UpdateInternalHrProfileCommand, UpdateInternalHrProfileResponse>
{
    private readonly IInternalHrProfileRepository _internalHrProfileRepository;
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly ILogger<UpdateInternalHrProfileCommandHandler> _logger;

    public UpdateInternalHrProfileCommandHandler(
        IInternalHrProfileRepository internalHrProfileRepository,
        IUserRepository userRepository,
        IUnitOfWork unitOfWork,
        IPhoneNormalizer phoneNormalizer,
        ILogger<UpdateInternalHrProfileCommandHandler> logger)
    {
        _internalHrProfileRepository = internalHrProfileRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _phoneNormalizer = phoneNormalizer;
        _logger = logger;
    }

    public async Task<UpdateInternalHrProfileResponse> Handle(
        UpdateInternalHrProfileCommand request,
        CancellationToken cancellationToken)
    {
        var profile = await _internalHrProfileRepository.GetByUserIdWithDetailsAsync(request.UserId, cancellationToken);
        if (profile == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ nhân sự Agency để cập nhật cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ nhân sự tương ứng với tài khoản này.");
        }

        if (!string.Equals(profile.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Tài khoản nhân sự UserId {UserId} đang ở trạng thái không hoạt động ({Status})", request.UserId, profile.Status);
            throw new ForbiddenException("Tài khoản nhân sự của bạn đang bị khóa hoặc không hoạt động.");
        }

        var now = DateTime.UtcNow;
        var cleanDisplayName = request.DisplayName.Trim();
        var cleanPhone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        var normalizedPhone = _phoneNormalizer.Normalize(cleanPhone);
        var cleanDepartment = string.IsNullOrWhiteSpace(request.Department) ? null : request.Department.Trim();
        var cleanJobTitle = string.IsNullOrWhiteSpace(request.JobTitle) ? null : request.JobTitle.Trim();

        profile.Department = cleanDepartment;
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

        _internalHrProfileRepository.Update(profile);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Cập nhật hồ sơ nhân sự Agency thành công cho UserId {UserId}", request.UserId);

        return new UpdateInternalHrProfileResponse
        {
            Success = true,
            Message = "Cập nhật hồ sơ nhân sự Agency thành công.",
            Data = new UpdateInternalHrProfileData
            {
                HrProfileId = profile.HrProfileId,
                UserId = profile.UserId,
                Email = user?.Email ?? profile.User?.Email ?? string.Empty,
                DisplayName = user?.DisplayName ?? cleanDisplayName,
                Phone = user?.Phone ?? cleanPhone,
                AvatarUrl = user?.AvatarUrl ?? profile.User?.AvatarUrl,
                EmployeeCode = profile.EmployeeCode,
                Department = profile.Department,
                JobTitle = profile.JobTitle,
                Status = profile.Status,
                CreatedAt = profile.CreatedAt,
                UpdatedAt = profile.UpdatedAt
            }
        };
    }
}
