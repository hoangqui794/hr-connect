using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Auth.Commands.LogoutAll;

public class LogoutAllCommandHandler : IRequestHandler<LogoutAllCommand, LogoutAllResponse>
{
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<LogoutAllCommandHandler> _logger;

    public LogoutAllCommandHandler(
        IRefreshTokenRepository refreshTokenRepository,
        ICurrentUserService currentUserService,
        IUnitOfWork unitOfWork,
        ILogger<LogoutAllCommandHandler> logger)
    {
        _refreshTokenRepository = refreshTokenRepository;
        _currentUserService = currentUserService;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<LogoutAllResponse> Handle(LogoutAllCommand request, CancellationToken cancellationToken)
    {
        var userId = request.UserId ?? _currentUserService.UserId;
        if (userId == null || userId == Guid.Empty)
        {
            _logger.LogWarning("Đăng xuất tất cả thiết bị thất bại: Không tìm thấy định danh người dùng đã xác thực.");
            throw new UnauthorizedException("User is not authenticated.");
        }

        await _refreshTokenRepository.RevokeAllByUserIdAsync(userId.Value, "LOGOUT_ALL", cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Người dùng {UserId} đã đăng xuất thành công khỏi tất cả các thiết bị.", userId.Value);

        return new LogoutAllResponse
        {
            Success = true,
            Message = "Đăng xuất khỏi tất cả thiết bị thành công."
        };
    }
}
