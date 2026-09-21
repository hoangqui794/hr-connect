using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Auth.Commands.Logout;

public class LogoutCommandHandler : IRequestHandler<LogoutCommand, LogoutResponse>
{
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IOtpService _otpService;
    private readonly ICurrentUserService _currentUserService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<LogoutCommandHandler> _logger;

    public LogoutCommandHandler(
        IRefreshTokenRepository refreshTokenRepository,
        IOtpService otpService,
        ICurrentUserService currentUserService,
        IUnitOfWork unitOfWork,
        ILogger<LogoutCommandHandler> logger)
    {
        _refreshTokenRepository = refreshTokenRepository;
        _otpService = otpService;
        _currentUserService = currentUserService;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<LogoutResponse> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        // 1. Xác định UserId từ ngữ cảnh xác thực (Claims / CurrentUser Service)
        var userId = request.UserId ?? _currentUserService.UserId;
        if (userId == null || userId == Guid.Empty)
        {
            _logger.LogWarning("Đăng xuất thất bại: Không tìm thấy định danh người dùng đã xác thực.");
            throw new UnauthorizedException("User is not authenticated.");
        }

        // 2. Băm Refresh Token để tra cứu an toàn trong database
        var tokenHash = _otpService.HashOtp(request.RefreshToken.Trim());

        // 3. Tìm Refresh Token theo hash
        var existingToken = await _refreshTokenRepository.GetByHashAsync(tokenHash, cancellationToken);

        if (existingToken != null)
        {
            // 4. Kiểm tra quyền sở hữu token (User A không thể thu hồi token của User B)
            if (existingToken.UserId != userId.Value)
            {
                _logger.LogWarning(
                    "CẢNH BÁO BẢO MẬT: Người dùng {CurrentUserId} cố gắng đăng xuất bằng Refresh Token thuộc về {TokenUserId}.",
                    userId.Value, existingToken.UserId);

                // Không thu hồi token của user khác, trả về kết quả an toàn (idempotent, không leak thông tin)
                return new LogoutResponse
                {
                    Success = true,
                    Message = "Đăng xuất thành công."
                };
            }

            // 5. Nếu token vẫn đang kích hoạt, tiến hành thu hồi phiên làm việc
            if (existingToken.RevokedAt == null)
            {
                existingToken.RevokedAt = DateTime.UtcNow;
                existingToken.RevokeReason = "LOGOUT";

                _refreshTokenRepository.Update(existingToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                _logger.LogInformation("Người dùng {UserId} đăng xuất thành công. Refresh token đã được thu hồi.", userId.Value);
            }
            else
            {
                _logger.LogInformation("Người dùng {UserId} đăng xuất với token đã thu hồi trước đó ({Reason}).",
                    userId.Value, existingToken.RevokeReason ?? "UNKNOWN");
            }
        }
        else
        {
            _logger.LogInformation("Người dùng {UserId} đăng xuất với token không tồn tại trong hệ thống.", userId.Value);
        }

        // 6. Trả về kết quả thành công an toàn (idempotent)
        return new LogoutResponse
        {
            Success = true,
            Message = "Đăng xuất thành công."
        };
    }
}
