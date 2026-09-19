using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateProfile;

public class UpdateAffiliateProfileCommandHandler : IRequestHandler<UpdateAffiliateProfileCommand, UpdateAffiliateProfileResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly ILogger<UpdateAffiliateProfileCommandHandler> _logger;

    public UpdateAffiliateProfileCommandHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        IUserRepository userRepository,
        IUnitOfWork unitOfWork,
        IPhoneNormalizer phoneNormalizer,
        ILogger<UpdateAffiliateProfileCommandHandler> logger)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _phoneNormalizer = phoneNormalizer;
        _logger = logger;
    }

    public async Task<UpdateAffiliateProfileResponse> Handle(UpdateAffiliateProfileCommand request, CancellationToken cancellationToken)
    {
        var profile = await _affiliateProfileRepository.GetByUserIdWithDetailsAsync(request.UserId, cancellationToken);

        if (profile == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ đối tác tuyển dụng để cập nhật cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy hồ sơ đối tác tuyển dụng tương ứng với tài khoản này.");
        }

        var now = DateTime.UtcNow;
        var normalizedPhone = _phoneNormalizer.Normalize(request.Phone);

        // Cập nhật thông tin AffiliateProfile
        profile.DisplayName = request.DisplayName.Trim();
        profile.ContactPerson = string.IsNullOrWhiteSpace(request.ContactPerson) ? null : request.ContactPerson.Trim();
        profile.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        profile.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        profile.TaxInformation = string.IsNullOrWhiteSpace(request.TaxInformation) ? null : request.TaxInformation.Trim();
        profile.UpdatedAt = now;

        // Đồng bộ DisplayName và Phone sang bảng AppUser
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user != null)
        {
            user.DisplayName = profile.DisplayName;
            user.Phone = profile.Phone;
            user.NormalizedPhone = normalizedPhone;
            user.UpdatedAt = now;
            _userRepository.Update(user);
        }

        _affiliateProfileRepository.Update(profile);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Cập nhật hồ sơ đối tác tuyển dụng thành công cho UserId {UserId}", request.UserId);

        return new UpdateAffiliateProfileResponse
        {
            Success = true,
            Message = "Cập nhật hồ sơ đối tác tuyển dụng thành công.",
            Data = new UpdateAffiliateProfileData
            {
                AffiliateId = profile.AffiliateId,
                UserId = profile.UserId,
                Email = profile.User?.Email ?? user?.Email ?? string.Empty,
                AvatarUrl = profile.User?.AvatarUrl ?? user?.AvatarUrl,
                AffiliateType = profile.AffiliateType,
                DisplayName = profile.DisplayName,
                ContactPerson = profile.ContactPerson,
                Phone = profile.Phone,
                Address = profile.Address,
                TaxInformation = profile.TaxInformation,
                Status = profile.Status,
                VerifiedAt = profile.VerifiedAt,
                UpdatedAt = profile.UpdatedAt
            }
        };
    }
}
