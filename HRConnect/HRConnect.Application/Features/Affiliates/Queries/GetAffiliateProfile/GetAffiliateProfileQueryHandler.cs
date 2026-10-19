using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateProfile;

public class GetAffiliateProfileQueryHandler : IRequestHandler<GetAffiliateProfileQuery, AffiliateProfileResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly IAvatarUrlResolver _avatarUrlResolver;
    private readonly ILogger<GetAffiliateProfileQueryHandler> _logger;

    public GetAffiliateProfileQueryHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        IAvatarUrlResolver avatarUrlResolver,
        ILogger<GetAffiliateProfileQueryHandler> logger)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _avatarUrlResolver = avatarUrlResolver;
        _logger = logger;
    }

    public async Task<AffiliateProfileResponse> Handle(GetAffiliateProfileQuery request, CancellationToken cancellationToken)
    {
        var profile = await _affiliateProfileRepository.GetByUserIdWithDetailsAsync(request.UserId, cancellationToken);

        if (profile == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ đối tác tuyển dụng cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy hồ sơ đối tác tuyển dụng tương ứng với tài khoản này.");
        }

        return new AffiliateProfileResponse
        {
            Success = true,
            Message = "Lấy thông tin hồ sơ đối tác tuyển dụng thành công.",
            Data = new AffiliateProfileData
            {
                AffiliateId = profile.AffiliateId,
                UserId = profile.UserId,
                Email = profile.User?.Email ?? string.Empty,
                AvatarUrl = profile.User is null ? null : _avatarUrlResolver.Resolve(profile.User),
                AffiliateType = profile.AffiliateType,
                DisplayName = profile.DisplayName,
                TaxInformation = profile.TaxInformation,
                ContactPerson = profile.ContactPerson,
                Phone = profile.Phone,
                Address = profile.Address,
                Status = profile.Status,
                VerifiedAt = profile.VerifiedAt,
                CreatedAt = profile.CreatedAt,
                UpdatedAt = profile.UpdatedAt
            }
        };
    }
}
