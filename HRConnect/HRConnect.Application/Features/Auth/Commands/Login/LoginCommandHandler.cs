using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.Login;

public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IOtpService _otpService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly JwtSettings _jwtSettings;
    private readonly ILogger<LoginCommandHandler> _logger;

    public LoginCommandHandler(
        IUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IPasswordHasher passwordHasher,
        IJwtTokenGenerator jwtTokenGenerator,
        IEmailNormalizer emailNormalizer,
        IOtpService otpService,
        IUnitOfWork unitOfWork,
        IOptions<JwtSettings> jwtOptions,
        ILogger<LoginCommandHandler> logger)
    {
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _passwordHasher = passwordHasher;
        _jwtTokenGenerator = jwtTokenGenerator;
        _emailNormalizer = emailNormalizer;
        _otpService = otpService;
        _unitOfWork = unitOfWork;
        _jwtSettings = jwtOptions.Value;
        _logger = logger;
    }

    public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        // 1. Chuẩn hóa email
        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            throw new BadRequestException("Email không hợp lệ.");
        }

        // 2. Tìm người dùng kèm vai trò và quyền hạn
        var user = await _userRepository.GetByEmailWithRolesAndPermissionsAsync(normalizedEmail, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("Đăng nhập thất bại: Không tìm thấy tài khoản {Email}", normalizedEmail);
            throw new UnauthorizedException("Email hoặc mật khẩu không chính xác.");
        }

        // 3. Xác thực mật khẩu
        var isPasswordValid = _passwordHasher.Verify(request.Password, user.PasswordHash);
        if (!isPasswordValid)
        {
            _logger.LogWarning("Đăng nhập thất bại: Sai mật khẩu cho tài khoản {Email}", normalizedEmail);
            throw new UnauthorizedException("Email hoặc mật khẩu không chính xác.");
        }

        // 4. Kiểm tra các ràng buộc đặc thù cho Affiliate Recruiter và Client Company User
        if (user.AffiliateApplicationUser != null)
        {
            if (user.EmailVerifiedAt == null)
            {
                _logger.LogWarning("Đăng nhập từ chối: Tài khoản Affiliate {Email} chưa xác thực email.", normalizedEmail);
                throw new ForbiddenException("Please verify your email before continuing.");
            }

            if (string.Equals(user.AffiliateApplicationUser.Status, "REJECTED", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Đăng nhập từ chối: Đơn đăng ký Affiliate của {Email} đã bị từ chối.", normalizedEmail);
                throw new ForbiddenException("Your registration was rejected.");
            }

            if (string.Equals(user.AffiliateApplicationUser.Status, "PENDING", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(user.AffiliateApplicationUser.Status, "UNDER_REVIEW", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Đăng nhập từ chối: Đơn đăng ký Affiliate của {Email} đang chờ Admin duyệt.", normalizedEmail);
                throw new ForbiddenException("Your registration is pending Admin approval.");
            }
        }

        var clientRequest = user.CompanyVerificationRequestSubmittedByNavigations.FirstOrDefault()
            ?? user.CompanyUsers.FirstOrDefault()?.Company?.CompanyVerificationRequest;
        var clientCompany = user.CompanyUsers.FirstOrDefault()?.Company;

        if (clientRequest != null || clientCompany != null)
        {
            if (user.EmailVerifiedAt == null)
            {
                _logger.LogWarning("Đăng nhập từ chối: Tài khoản Client {Email} chưa xác thực email.", normalizedEmail);
                throw new ForbiddenException("Please verify your email before continuing.");
            }

            var isRequestRejected = clientRequest != null && string.Equals(clientRequest.Status, "REJECTED", StringComparison.OrdinalIgnoreCase);
            var isCompanyRejected = clientCompany != null && string.Equals(clientCompany.VerificationStatus, "REJECTED", StringComparison.OrdinalIgnoreCase);

            if (isRequestRejected || isCompanyRejected)
            {
                _logger.LogWarning("Đăng nhập từ chối: Đăng ký doanh nghiệp của {Email} đã bị từ chối.", normalizedEmail);
                throw new ForbiddenException("Your registration was rejected.");
            }

            var isRequestPending = clientRequest != null && (string.Equals(clientRequest.Status, "PENDING", StringComparison.OrdinalIgnoreCase) || string.Equals(clientRequest.Status, "UNDER_REVIEW", StringComparison.OrdinalIgnoreCase));
            var isCompanyPending = clientCompany != null && (string.Equals(clientCompany.VerificationStatus, "PENDING", StringComparison.OrdinalIgnoreCase) || string.Equals(clientCompany.VerificationStatus, "UNDER_REVIEW", StringComparison.OrdinalIgnoreCase));

            if (isRequestPending || isCompanyPending)
            {
                _logger.LogWarning("Đăng nhập từ chối: Đăng ký doanh nghiệp của {Email} đang chờ Admin duyệt.", normalizedEmail);
                throw new ForbiddenException("Your registration is pending Admin approval.");
            }
        }

        // 5. Kiểm tra trạng thái tài khoản chung (Ứng viên & người dùng khác)
        if (string.Equals(user.Status, "PENDING", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Đăng nhập từ chối: Tài khoản {Email} chưa xác thực email (PENDING)", normalizedEmail);
            throw new BadRequestException("Tài khoản của bạn chưa được kích hoạt. Vui lòng kiểm tra email để nhập mã OTP kích hoạt tài khoản.");
        }

        if (string.Equals(user.Status, "SUSPENDED", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Đăng nhập từ chối: Tài khoản {Email} đã bị khóa (SUSPENDED)", normalizedEmail);
            throw new BadRequestException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.");
        }

        var activeRoles = user.UserRoleUsers
            .Where(ur => string.Equals(ur.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            .Select(ur => ur.Role.Code)
            .Distinct()
            .ToList();

        if (activeRoles.Count == 0)
        {
            _logger.LogWarning("Đăng nhập từ chối: Tài khoản {Email} không có vai trò kích hoạt nào trong hệ thống.", normalizedEmail);
            throw new ForbiddenException("Tài khoản chưa được phân quyền truy cập hệ thống.");
        }

        var activePermissions = user.UserRoleUsers
            .Where(ur => string.Equals(ur.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.Code)
            .Distinct()
            .OrderBy(p => p)
            .ToList();

        // 6. Phát hành JWT Access Token
        var (accessToken, expiresAt) = _jwtTokenGenerator.GenerateAccessToken(user, activeRoles, activePermissions);

        // 7. Tạo Refresh Token an toàn (lưu hash SHA256)
        var rawRefreshToken = _jwtTokenGenerator.GenerateRefreshToken();
        var refreshTokenHash = _otpService.HashOtp(rawRefreshToken);
        var refreshExpiryDays = _jwtSettings.RefreshTokenExpiryDays > 0 ? _jwtSettings.RefreshTokenExpiryDays : 7;
        var now = DateTime.UtcNow;

        var refreshTokenEntity = new HRConnect.Domain.Entities.RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenHash = refreshTokenHash,
            ExpiresAt = now.AddDays(refreshExpiryDays),
            CreatedAt = now
        };

        await _refreshTokenRepository.AddAsync(refreshTokenEntity, cancellationToken);

        // 8. Cập nhật thời điểm đăng nhập gần nhất
        user.LastLoginAt = now;
        user.UpdatedAt = now;
        _userRepository.Update(user);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Người dùng {Email} (UserId: {UserId}) đăng nhập thành công với các quyền: [{Roles}]", 
            user.Email, user.UserId, string.Join(", ", activeRoles));

        return new LoginResponse
        {
            Success = true,
            Message = "Đăng nhập thành công.",
            Data = new LoginData
            {
                AccessToken = accessToken,
                RefreshToken = rawRefreshToken,
                TokenType = "Bearer",
                ExpiresAt = expiresAt,
                RefreshTokenExpiresAt = refreshTokenEntity.ExpiresAt,
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
}
