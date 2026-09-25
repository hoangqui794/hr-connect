using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.Queries.GetAdminProfile;

public class GetAdminProfileQueryHandler : IRequestHandler<GetAdminProfileQuery, AdminProfileResponse>
{
    private readonly IAdminProfileRepository _adminProfileRepository;

    public GetAdminProfileQueryHandler(IAdminProfileRepository adminProfileRepository)
    {
        _adminProfileRepository = adminProfileRepository;
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
                AvatarUrl     = profile.User?.AvatarUrl,
                EmployeeCode  = profile.EmployeeCode,
                JobTitle      = profile.JobTitle,
                Status        = profile.Status,
                CreatedAt     = profile.CreatedAt,
                UpdatedAt     = profile.UpdatedAt
            }
        };
    }
}
