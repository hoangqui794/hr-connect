using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Interfaces;
using MediatR;

namespace HRConnect.Application.Features.Admin.Queries.GetAdminProfile;

public class GetAdminProfileQueryHandler : IRequestHandler<GetAdminProfileQuery, AdminProfileResponse>
{
    private readonly IAdminProfileRepository _adminProfileRepository;
    private readonly IAvatarUrlResolver _avatarUrlResolver;

    public GetAdminProfileQueryHandler(IAdminProfileRepository adminProfileRepository, IAvatarUrlResolver avatarUrlResolver)
    {
        _adminProfileRepository = adminProfileRepository;
        _avatarUrlResolver = avatarUrlResolver;
    }

    public async Task<AdminProfileResponse> Handle(GetAdminProfileQuery request, CancellationToken cancellationToken)
    {
        var profile = await _adminProfileRepository.GetByUserIdWithDetailsAsync(request.UserId, cancellationToken);

        if (profile == null)
        {
            throw new NotFoundException($"Không tìm thấy hồ sơ quản trị viên với UserId: {request.UserId}");
        }

        return new AdminProfileResponse
        {
            Success = true,
            Message = "Lấy thông tin hồ sơ quản trị viên thành công.",
            Data = new AdminProfileData
            {
                AdminProfileId = profile.AdminProfileId,
                UserId        = profile.UserId,
                Email         = profile.User?.Email,
                DisplayName   = profile.User?.DisplayName,
                Phone         = profile.User?.Phone,
                AvatarUrl     = profile.User is null ? null : _avatarUrlResolver.Resolve(profile.User),
                EmployeeCode  = profile.EmployeeCode,
                JobTitle      = profile.JobTitle,
                Status        = profile.Status,
                CreatedAt     = profile.CreatedAt,
                UpdatedAt     = profile.UpdatedAt
            }
        };
    }
}
