using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.InternalHr.Queries.GetInternalHrProfile;

public class GetInternalHrProfileQueryHandler : IRequestHandler<GetInternalHrProfileQuery, InternalHrProfileResponse>
{
    private readonly IInternalHrProfileRepository _internalHrProfileRepository;
    private readonly ILogger<GetInternalHrProfileQueryHandler> _logger;

    public GetInternalHrProfileQueryHandler(
        IInternalHrProfileRepository internalHrProfileRepository,
        ILogger<GetInternalHrProfileQueryHandler> logger)
    {
        _internalHrProfileRepository = internalHrProfileRepository;
        _logger = logger;
    }

    public async Task<InternalHrProfileResponse> Handle(
        GetInternalHrProfileQuery request,
        CancellationToken cancellationToken)
    {
        var profile = await _internalHrProfileRepository.GetByUserIdWithDetailsAsync(request.UserId, cancellationToken);
        if (profile == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ nhân sự Agency cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ nhân sự tương ứng với tài khoản này.");
        }

        return new InternalHrProfileResponse
        {
            Success = true,
            Message = "Lấy thông tin hồ sơ nhân sự Agency thành công.",
            Data = new InternalHrProfileData
            {
                HrProfileId = profile.HrProfileId,
                UserId = profile.UserId,
                Email = profile.User?.Email ?? string.Empty,
                DisplayName = profile.User?.DisplayName ?? string.Empty,
                Phone = profile.User?.Phone,
                AvatarUrl = profile.User?.AvatarUrl,
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
