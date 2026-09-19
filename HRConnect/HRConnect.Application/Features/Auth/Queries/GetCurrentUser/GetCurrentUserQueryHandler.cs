using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Auth.Queries.GetCurrentUser;

public class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, CurrentUserResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<GetCurrentUserQueryHandler> _logger;

    public GetCurrentUserQueryHandler(
        IUserRepository userRepository,
        ICurrentUserService currentUserService,
        ILogger<GetCurrentUserQueryHandler> logger)
    {
        _userRepository = userRepository;
        _currentUserService = currentUserService;
        _logger = logger;
    }

    public async Task<CurrentUserResponse> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        // 1. Xác định UserId từ tham số truy vấn hoặc ngữ cảnh xác thực (ICurrentUserService)
        var targetUserId = request.UserId ?? _currentUserService.UserId;
        if (targetUserId == null || targetUserId == Guid.Empty)
        {
            _logger.LogWarning("GetCurrentUser: Người dùng chưa được xác thực (chưa có token hoặc claim không hợp lệ).");
            throw new UnauthorizedException("User is not authenticated.");
        }

        // 2. Truy vấn người dùng kèm vai trò và quyền hạn mới nhất từ DB
        var user = await _userRepository.GetByIdWithRolesAndPermissionsAsync(targetUserId.Value, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("GetCurrentUser: Không tìm thấy người dùng có ID {UserId}.", targetUserId.Value);
            throw new NotFoundException("User not found.");
        }

        // 3. Lấy danh sách các vai trò đang kích hoạt (ACTIVE)
        var activeRoles = user.UserRoleUsers
            .Where(ur => string.Equals(ur.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) && (ur.Role == null || ur.Role.IsActive))
            .Select(ur => ur.Role.Code)
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct()
            .OrderBy(r => r)
            .ToList();

        // 4. Lấy danh sách quyền hạn hiệu lực từ các vai trò đang kích hoạt
        var activePermissions = user.UserRoleUsers
            .Where(ur => string.Equals(ur.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) && (ur.Role == null || ur.Role.IsActive))
            .SelectMany(ur => ur.Role.RolePermissions)
            .Where(rp => rp.Permission != null && rp.Permission.IsActive)
            .Select(rp => rp.Permission.Code)
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct()
            .OrderBy(p => p)
            .ToList();

        // 5. Khởi tạo DTO bảo mật (không lộ password_hash, token, hay thông tin nhạy cảm)
        var dto = new CurrentUserDto
        {
            UserId = user.UserId,
            Email = user.Email,
            DisplayName = user.DisplayName,
            Phone = user.Phone,
            AvatarUrl = user.AvatarUrl,
            Status = user.Status,
            EmailVerified = user.EmailVerifiedAt.HasValue,
            Roles = activeRoles,
            Permissions = activePermissions
        };

        return new CurrentUserResponse
        {
            Success = true,
            Message = "Lấy thông tin người dùng thành công.",
            Data = dto
        };
    }
}
