using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Auth.Commands.ChangePassword;

public class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand, ChangePasswordResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ChangePasswordCommandHandler> _logger;

    public ChangePasswordCommandHandler(
        IUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IPasswordHasher passwordHasher,
        ICurrentUserService currentUserService,
        IAuditLogService auditLogService,
        IUnitOfWork unitOfWork,
        ILogger<ChangePasswordCommandHandler> logger)
    {
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _passwordHasher = passwordHasher;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ChangePasswordResponse> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        // 1. Xác định UserId từ ngữ cảnh xác thực (Claims / CurrentUser Service)
        var userId = request.UserId ?? _currentUserService.UserId;
        if (userId == null || userId == Guid.Empty)
        {
            _logger.LogWarning("Đổi mật khẩu thất bại: Không tìm thấy định danh người dùng đã xác thực.");
            throw new UnauthorizedException("Bạn chưa đăng nhập hoặc phiên đăng nhập không hợp lệ.");
        }

        // 2. Tìm người dùng
        var user = await _userRepository.GetByIdAsync(userId.Value, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("Đổi mật khẩu thất bại: Không tìm thấy người dùng UserId {UserId}", userId.Value);
            throw new NotFoundException("Không tìm thấy tài khoản.");
        }

        // 3. Kiểm tra tài khoản có hỗ trợ mật khẩu cục bộ không (chặn tài khoản Google-only)
        var isGoogleOnly = string.IsNullOrWhiteSpace(user.PasswordHash) ||
                           user.PasswordHash.StartsWith("GOOGLE", StringComparison.OrdinalIgnoreCase);

        if (isGoogleOnly)
        {
            _logger.LogWarning("Đổi mật khẩu thất bại: Tài khoản Google UserId {UserId} không hỗ trợ đổi mật khẩu cục bộ.", userId.Value);
            throw new BadRequestException("Tài khoản này không hỗ trợ đổi mật khẩu bằng mật khẩu hiện tại.");
        }

        // 4. Kiểm tra mật khẩu hiện tại
        var isCurrentPasswordValid = _passwordHasher.Verify(request.CurrentPassword, user.PasswordHash);
        if (!isCurrentPasswordValid)
        {
            _logger.LogWarning("Đổi mật khẩu thất bại: Mật khẩu hiện tại không chính xác cho UserId {UserId}", userId.Value);
            throw new BadRequestException("Mật khẩu hiện tại không chính xác.");
        }

        // 5. Kiểm tra mật khẩu mới không được trùng với mật khẩu hiện tại
        if (_passwordHasher.Verify(request.NewPassword, user.PasswordHash))
        {
            _logger.LogWarning("Đổi mật khẩu thất bại: Mật khẩu mới trùng mật khẩu hiện tại cho UserId {UserId}", userId.Value);
            throw new BadRequestException("Mật khẩu mới phải khác mật khẩu hiện tại.");
        }

        // 6. Thực hiện đổi mật khẩu trong Transaction nguyên tử (Atomic Transaction)
        var now = DateTime.UtcNow;

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            // Băm và lưu mật khẩu mới
            user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
            user.UpdatedAt = now;
            _userRepository.Update(user);

            // Thu hồi các phiên đăng nhập khác / Refresh Token hiện tại
            await _refreshTokenRepository.RevokeAllByUserIdAsync(user.UserId, "PASSWORD_CHANGE", cancellationToken);

            // Ghi audit PASSWORD_CHANGED cùng transaction
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.PasswordChanged,
                EntityType = "APP_USER",
                EntityId = user.UserId,
                ActorUserId = user.UserId,
                ActorType = AuditActorTypes.User,
                NewValues = new { userId = user.UserId, sessionsRevoked = true },
                Source = AuditSources.Api
            }, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi xảy ra trong giao dịch đổi mật khẩu cho UserId {UserId}", userId.Value);
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        _logger.LogInformation("Đổi mật khẩu thành công cho UserId {UserId}.", userId.Value);

        return new ChangePasswordResponse();
    }
}
