using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.Login;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.RefreshToken;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, RefreshTokenResponse>
{
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IUserRepository _userRepository;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IOtpService _otpService;
    private readonly IAuditLogService _auditLogService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly JwtSettings _jwtSettings;
    private readonly ILogger<RefreshTokenCommandHandler> _logger;

    public RefreshTokenCommandHandler(
        IRefreshTokenRepository refreshTokenRepository,
        IUserRepository userRepository,
        IJwtTokenGenerator jwtTokenGenerator,
        IOtpService otpService,
        IAuditLogService auditLogService,
        IUnitOfWork unitOfWork,
        IOptions<JwtSettings> jwtOptions,
        ILogger<RefreshTokenCommandHandler> logger)
    {
        _refreshTokenRepository = refreshTokenRepository;
        _userRepository = userRepository;
        _jwtTokenGenerator = jwtTokenGenerator;
        _otpService = otpService;
        _auditLogService = auditLogService;
        _unitOfWork = unitOfWork;
        _jwtSettings = jwtOptions.Value;
        _logger = logger;
    }

    public async Task<RefreshTokenResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            throw new BadRequestException("Token làm mới không hợp lệ hoặc đã hết hạn.");
        }

        var incomingTokenHash = _otpService.HashOtp(request.RefreshToken.Trim());

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        var transactionCommitted = false;

        try
        {
            // 1. Tìm RefreshToken theo token hash
            var existingToken = await _refreshTokenRepository.GetByHashAsync(incomingTokenHash, cancellationToken);
            if (existingToken == null)
            {
                _logger.LogWarning("Refresh token không tồn tại trong hệ thống.");
                throw new BadRequestException("Token làm mới không hợp lệ hoặc đã hết hạn.");
            }

            // 2. Phát hiện hành vi sử dụng lại token (Replay / Reuse Detection)
            if (existingToken.RevokedAt != null || existingToken.ReplacedByTokenId != null)
            {
                _logger.LogWarning(
                    "CẢNH BÁO BẢO MẬT: Phát hiện tái sử dụng refresh token đã thu hồi/thay thế đối với UserId {UserId}. Thu hồi toàn bộ phiên đăng nhập.",
                    existingToken.UserId);

                await _refreshTokenRepository.RevokeAllByUserIdAsync(existingToken.UserId, "TOKEN_REUSE_DETECTED", cancellationToken);

                // Ghi audit REFRESH_TOKEN_REUSE_DETECTED trước commit cùng transaction
                await _auditLogService.AddAsync(new AuditEntry
                {
                    Action = AuditActions.RefreshTokenReuseDetected,
                    EntityType = "REFRESH_TOKEN",
                    EntityId = existingToken.RefreshTokenId,
                    ActorType = AuditActorTypes.System,
                    NewValues = new { affectedUserId = existingToken.UserId, allSessionsRevoked = true },
                    Source = AuditSources.Api
                }, cancellationToken);

                await _unitOfWork.SaveChangesAsync(cancellationToken);
                await _unitOfWork.CommitTransactionAsync(cancellationToken);
                transactionCommitted = true;

                throw new BadRequestException("Token làm mới không hợp lệ hoặc đã hết hạn.");
            }

            // 3. Kiểm tra thời hạn hết hạn
            if (existingToken.ExpiresAt <= DateTime.UtcNow)
            {
                _logger.LogWarning("Refresh token của UserId {UserId} đã hết hạn vào {ExpiresAt}",
                    existingToken.UserId, existingToken.ExpiresAt);
                throw new BadRequestException("Token làm mới không hợp lệ hoặc đã hết hạn.");
            }

            // 4. Lấy thông tin người dùng kèm vai trò và quyền hạn mới nhất từ DB
            var user = await _userRepository.GetByIdWithRolesAndPermissionsAsync(existingToken.UserId, cancellationToken);
            if (user == null)
            {
                _logger.LogWarning("Không tìm thấy người dùng UserId {UserId} tương ứng với refresh token.", existingToken.UserId);
                throw new BadRequestException("Token làm mới không hợp lệ hoặc đã hết hạn.");
            }

            // 5. Kiểm tra trạng thái tài khoản
            if (string.Equals(user.Status, "SUSPENDED", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(user.Status, "LOCKED", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(user.Status, "DISABLED", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Từ chối refresh token: Tài khoản {Email} đã bị khóa ({Status}).", user.Email, user.Status);
                throw new BadRequestException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.");
            }

            if (string.Equals(user.Status, "PENDING", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Từ chối refresh token: Tài khoản {Email} chưa được kích hoạt.", user.Email);
                throw new BadRequestException("Tài khoản chưa được kích hoạt.");
            }

            // 6. Kiểm tra các ràng buộc đặc thù cho Affiliate và Client
            if (user.AffiliateApplicationUser != null)
            {
                if (user.EmailVerifiedAt == null)
                {
                    _logger.LogWarning("Từ chối refresh token: Tài khoản Affiliate {Email} chưa xác thực email.", user.Email);
                    throw new ForbiddenException("Vui lòng xác thực email trước khi tiếp tục.");
                }

                if (string.Equals(user.AffiliateApplicationUser.Status, "REJECTED", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("Từ chối refresh token: Đơn Affiliate của {Email} đã bị từ chối.", user.Email);
                    throw new ForbiddenException("Hồ sơ đăng ký của bạn đã bị từ chối.");
                }
            }

            var clientRequest = user.CompanyVerificationRequestSubmittedByNavigations.FirstOrDefault()
                ?? user.CompanyUsers.FirstOrDefault()?.Company?.CompanyVerificationRequest;
            var clientCompany = user.CompanyUsers.FirstOrDefault()?.Company;

            if (clientRequest != null || clientCompany != null)
            {
                if (user.EmailVerifiedAt == null)
                {
                    _logger.LogWarning("Từ chối refresh token: Tài khoản Client {Email} chưa xác thực email.", user.Email);
                    throw new ForbiddenException("Vui lòng xác thực email trước khi tiếp tục.");
                }

                var isRequestRejected = clientRequest != null && string.Equals(clientRequest.Status, "REJECTED", StringComparison.OrdinalIgnoreCase);
                var isCompanyRejected = clientCompany != null && string.Equals(clientCompany.VerificationStatus, "REJECTED", StringComparison.OrdinalIgnoreCase);

                if (isRequestRejected || isCompanyRejected)
                {
                    _logger.LogWarning("Từ chối refresh token: Đăng ký doanh nghiệp của {Email} đã bị từ chối.", user.Email);
                    throw new ForbiddenException("Hồ sơ đăng ký của bạn đã bị từ chối.");
                }
            }

            var activeRoles = user.UserRoleUsers
                .Where(ur => string.Equals(ur.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
                             ur.Role.IsActive)
                .Select(ur => ur.Role.Code)
                .Distinct()
                .ToList();

            if (activeRoles.Count == 0)
            {
                _logger.LogWarning("Từ chối refresh token: Tài khoản {Email} không có vai trò kích hoạt nào.", user.Email);
                throw new ForbiddenException("Tài khoản chưa được phân quyền truy cập hệ thống.");
            }

            var activePermissions = user.UserRoleUsers
                .Where(ur => string.Equals(ur.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
                             ur.Role.IsActive)
                .SelectMany(ur => ur.Role.RolePermissions)
                .Where(rp => rp.Permission.IsActive)
                .Select(rp => rp.Permission.Code)
                .Distinct()
                .OrderBy(p => p)
                .ToList();

            // 7. Tạo mới JWT Access Token
            var (newAccessToken, accessExpiresAt) = _jwtTokenGenerator.GenerateAccessToken(user, activeRoles, activePermissions);

            // 8. Tạo mới Refresh Token ngẫu nhiên bảo mật cao và băm lưu trữ
            var newRawRefreshToken = _jwtTokenGenerator.GenerateRefreshToken();
            var newRefreshTokenHash = _otpService.HashOtp(newRawRefreshToken);
            var refreshExpiryDays = _jwtSettings.RefreshTokenExpiryDays > 0 ? _jwtSettings.RefreshTokenExpiryDays : 7;
            var now = DateTime.UtcNow;
            var refreshExpiresAt = now.AddDays(refreshExpiryDays);

            var newRefreshTokenEntity = new Domain.Entities.RefreshToken
            {
                RefreshTokenId = Guid.NewGuid(),
                UserId = user.UserId,
                TokenHash = newRefreshTokenHash,
                ExpiresAt = refreshExpiresAt,
                CreatedAt = now
            };

            // 9. Thực hiện xoay vòng token (Refresh Token Rotation)
            existingToken.RevokedAt = now;
            existingToken.RevokeReason = "ROTATED";
            existingToken.ReplacedByTokenId = newRefreshTokenEntity.RefreshTokenId;
            _refreshTokenRepository.Update(existingToken);

            await _refreshTokenRepository.AddAsync(newRefreshTokenEntity, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
            transactionCommitted = true;

            _logger.LogInformation("Xoay vòng refresh token thành công cho UserId {UserId} ({Email}).", user.UserId, user.Email);

            return new RefreshTokenResponse
            {
                Success = true,
                Message = "Làm mới token thành công.",
                Data = new RefreshTokenData
                {
                    AccessToken = newAccessToken,
                    RefreshToken = newRawRefreshToken,
                    TokenType = "Bearer",
                    ExpiresAt = accessExpiresAt,
                    RefreshTokenExpiresAt = refreshExpiresAt,
                    User = new UserInfoData
                    {
                        UserId = user.UserId,
                        Email = user.Email,
                        DisplayName = user.DisplayName,
                        Status = user.Status,
                        Roles = activeRoles,
                        Permissions = activePermissions
                    }
                }
            };
        }
        catch
        {
            // Reuse detection deliberately returns 400 after its revocation/audit transaction
            // has committed. Do not roll back or clear that completed unit of work.
            if (!transactionCommitted)
            {
                await _unitOfWork.RollbackTransactionAsync(CancellationToken.None);
            }

            throw;
        }
    }
}
