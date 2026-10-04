using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Admin.Users.Commands.UnlockUser;

public sealed record UnlockUserCommand(Guid UserId, Guid ActorUserId) : IRequest<AdminUserActionResponse>;

public sealed class UnlockUserCommandHandler : IRequestHandler<UnlockUserCommand, AdminUserActionResponse>
{
    private readonly IAdminUserRepository _userRepository;
    private readonly IAuditLogService _auditLogService;
    private readonly IUnitOfWork _unitOfWork;

    public UnlockUserCommandHandler(
        IAdminUserRepository userRepository,
        IAuditLogService auditLogService,
        IUnitOfWork unitOfWork)
    {
        _userRepository = userRepository;
        _auditLogService = auditLogService;
        _unitOfWork = unitOfWork;
    }

    public async Task<AdminUserActionResponse> Handle(
        UnlockUserCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(
            request.UserId, tracking: true, cancellationToken)
            ?? throw new NotFoundException($"Không tìm thấy người dùng với mã {request.UserId}.");

        if (AdminUserListItemDto.ActiveRoles(user).Contains("PLATFORM_ADMIN", StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Không được mở khóa đăng nhập cho tài khoản Platform Admin qua API này.");
        }

        var now = DateTime.UtcNow;
        var wasLocked = user.LockoutEndAt.HasValue && user.LockoutEndAt.Value > now;
        var oldLockoutEndAt = user.LockoutEndAt;
        var oldFailedAttempts = user.FailedLoginAttempts;
        user.LockoutEndAt = null;
        user.FailedLoginAttempts = 0;
        user.UpdatedAt = now;
        _userRepository.Update(user);

        if (wasLocked || oldFailedAttempts > 0)
        {
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.UserLoginUnlocked,
                EntityType = "APP_USER",
                EntityId = user.UserId,
                ActorUserId = request.ActorUserId,
                OldValues = new { lockoutEndAt = oldLockoutEndAt, failedLoginAttempts = oldFailedAttempts },
                NewValues = new { lockoutEndAt = (DateTime?)null, failedLoginAttempts = 0 }
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new AdminUserActionResponse
        {
            Message = wasLocked || oldFailedAttempts > 0
                ? "Mở khóa đăng nhập thành công."
                : "Tài khoản hiện không bị khóa đăng nhập.",
            Data = AdminUserDetailDto.From(user, now)
        };
    }
}
