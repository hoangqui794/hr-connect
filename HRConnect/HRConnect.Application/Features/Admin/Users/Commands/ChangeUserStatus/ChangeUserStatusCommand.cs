using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Admin.Users.Commands.ChangeUserStatus;

public sealed record ChangeUserStatusCommand(
    Guid UserId,
    Guid ActorUserId,
    string Status,
    string? Reason) : IRequest<AdminUserActionResponse>;

public sealed class ChangeUserStatusCommandValidator : AbstractValidator<ChangeUserStatusCommand>
{
    public ChangeUserStatusCommandValidator()
    {
        RuleFor(command => command.UserId).NotEmpty();
        RuleFor(command => command.ActorUserId).NotEmpty();
        RuleFor(command => command.Status)
            .NotEmpty()
            .Must(status => string.Equals(status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(status, "SUSPENDED", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Trạng thái đích chỉ có thể là ACTIVE hoặc SUSPENDED.");
        RuleFor(command => command.Reason)
            .MaximumLength(500)
            .Must(reason => !string.IsNullOrWhiteSpace(reason))
            .When(command => string.Equals(command.Status, "SUSPENDED", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Lý do tạm khóa là bắt buộc.");
    }
}

public sealed class ChangeUserStatusCommandHandler : IRequestHandler<ChangeUserStatusCommand, AdminUserActionResponse>
{
    private const string PlatformAdminRole = "PLATFORM_ADMIN";
    private readonly IAdminUserRepository _userRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IAuditLogService _auditLogService;
    private readonly IUnitOfWork _unitOfWork;

    public ChangeUserStatusCommandHandler(
        IAdminUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IAuditLogService auditLogService,
        IUnitOfWork unitOfWork)
    {
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _auditLogService = auditLogService;
        _unitOfWork = unitOfWork;
    }

    public async Task<AdminUserActionResponse> Handle(
        ChangeUserStatusCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(
            request.UserId, tracking: true, cancellationToken)
            ?? throw new NotFoundException($"Không tìm thấy người dùng với mã {request.UserId}.");

        EnsureTargetIsNotPlatformAdmin(user);

        var currentStatus = user.Status.ToUpperInvariant();
        var targetStatus = request.Status.Trim().ToUpperInvariant();
        var validTransition =
            (currentStatus == "ACTIVE" && targetStatus == "SUSPENDED") ||
            (currentStatus == "SUSPENDED" && targetStatus == "ACTIVE");
        if (!validTransition)
        {
            throw new BadRequestException($"Không thể chuyển trạng thái người dùng từ {currentStatus} sang {targetStatus}.");
        }

        var now = DateTime.UtcNow;
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        user.Status = targetStatus;
        user.UpdatedAt = now;
        _userRepository.Update(user);

        if (targetStatus == "SUSPENDED")
        {
            await _refreshTokenRepository.RevokeAllByUserIdAsync(
                user.UserId, "USER_SUSPENDED", cancellationToken);
        }

        var action = targetStatus == "SUSPENDED"
            ? AuditActions.UserSuspended
            : AuditActions.UserReactivated;
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = action,
            EntityType = "APP_USER",
            EntityId = user.UserId,
            ActorUserId = request.ActorUserId,
            OldValues = new { status = currentStatus },
            NewValues = new { status = targetStatus, reason }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new AdminUserActionResponse
        {
            Message = targetStatus == "SUSPENDED"
                ? "Tạm khóa tài khoản thành công."
                : "Kích hoạt lại tài khoản thành công.",
            Data = AdminUserDetailDto.From(user, now)
        };
    }

    private static void EnsureTargetIsNotPlatformAdmin(HRConnect.Domain.Entities.AppUser user)
    {
        if (AdminUserListItemDto.ActiveRoles(user).Contains(PlatformAdminRole, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Không được thay đổi trạng thái của tài khoản Platform Admin.");
        }
    }
}
