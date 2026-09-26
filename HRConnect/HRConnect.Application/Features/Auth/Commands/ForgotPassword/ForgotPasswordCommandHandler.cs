using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.ForgotPassword;

public class ForgotPasswordCommandHandler : IRequestHandler<ForgotPasswordCommand, ForgotPasswordResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IEmailService _emailService;
    private readonly IOtpService _otpService;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IUnitOfWork _unitOfWork;
    private readonly AuthenticationSettings _authSettings;
    private readonly ILogger<ForgotPasswordCommandHandler> _logger;

    public ForgotPasswordCommandHandler(
        IUserRepository userRepository,
        IUserTokenRepository userTokenRepository,
        IEmailService emailService,
        IOtpService otpService,
        IEmailNormalizer emailNormalizer,
        IUnitOfWork unitOfWork,
        IOptions<AuthenticationSettings> authOptions,
        ILogger<ForgotPasswordCommandHandler> logger)
    {
        _userRepository = userRepository;
        _userTokenRepository = userTokenRepository;
        _emailService = emailService;
        _otpService = otpService;
        _emailNormalizer = emailNormalizer;
        _unitOfWork = unitOfWork;
        _authSettings = authOptions.Value;
        _logger = logger;
    }

    public async Task<ForgotPasswordResponse> Handle(ForgotPasswordCommand request, CancellationToken cancellationToken)
    {
        // 1. Chuẩn hóa email
        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return new ForgotPasswordResponse();
        }

        // 2. Tìm người dùng theo email đã chuẩn hóa
        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);

        // 3. Phòng chống Account Enumeration: Luôn trả về phản hồi chung
        if (user == null)
        {
            _logger.LogInformation("Yêu cầu đặt lại mật khẩu cho email không tồn tại trong hệ thống: {Email}", normalizedEmail);
            return new ForgotPasswordResponse();
        }

        // 4. Kiểm tra điều kiện đặt lại mật khẩu cục bộ (không hỗ trợ tài khoản Google-only hoặc tài khoản bị khóa)
        var isGoogleOnly = string.IsNullOrWhiteSpace(user.PasswordHash) ||
                           user.PasswordHash.StartsWith("GOOGLE", StringComparison.OrdinalIgnoreCase);

        var isBlockedOrDeleted = string.Equals(user.Status, "BLOCKED", StringComparison.OrdinalIgnoreCase) ||
                                 string.Equals(user.Status, "DELETED", StringComparison.OrdinalIgnoreCase);

        if (isGoogleOnly || isBlockedOrDeleted)
        {
            _logger.LogWarning("Tài khoản {Email} không đủ điều kiện đặt lại mật khẩu cục bộ (GoogleOnly: {IsGoogle}, Status: {Status})",
                normalizedEmail, isGoogleOnly, user.Status);
            return new ForgotPasswordResponse();
        }

        // 5. Thu hồi / Vô hiệu hóa các mã OTP PASSWORD_RESET đang hoạt động trước đó
        await _userTokenRepository.InvalidateActiveTokensAsync(user.UserId, "PASSWORD_RESET", cancellationToken);

        // 6. Sinh mã OTP bảo mật và băm mã trước khi lưu
        var otpLength = _authSettings.Otp?.Length > 0 ? _authSettings.Otp.Length : 6;
        var expirationMinutes = _authSettings.Otp?.ExpirationMinutes > 0 ? _authSettings.Otp.ExpirationMinutes : 15;

        var rawOtp = _otpService.GenerateNumericOtp(otpLength);
        var otpHash = _otpService.HashOtp(rawOtp);
        var now = DateTime.UtcNow;

        _logger.LogInformation("Đã sinh mã OTP đặt lại mật khẩu cho UserId {UserId}, Email {Email}. Thời hạn {Minutes} phút.",
            user.UserId, normalizedEmail, expirationMinutes);

        // 7. Tạo bản ghi UserToken với mục đích PASSWORD_RESET
        var userToken = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenType = "PASSWORD_RESET",
            TokenHash = otpHash,
            ExpiresAt = now.AddMinutes(expirationMinutes),
            UsedAt = null,
            AttemptCount = 0,
            CreatedAt = now
        };

        await _userTokenRepository.AddAsync(userToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // 8. Gửi email chứa mã OTP đặt lại mật khẩu
        try
        {
            var recipientName = string.IsNullOrWhiteSpace(user.DisplayName) ? "bạn" : user.DisplayName.Trim();
            var bodyHtml = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
                    <h2>HR Connect - Đặt lại mật khẩu</h2>
                    <p>Xin chào <strong>{recipientName}</strong>,</p>
                    <p>Mã OTP của bạn là <strong style='font-size: 28px; letter-spacing: 5px;'>{rawOtp}</strong>.</p>
                    <p>Mã có hiệu lực trong {expirationMinutes} phút. Không chia sẻ mã này cho bất kỳ ai.</p>
                </div>";

            var emailResult = await _emailService.SendEmailAsync(
                user.Email, "HR Connect - Mã xác thực đặt lại mật khẩu", bodyHtml, cancellationToken);
            if (!emailResult.IsSuccess)
            {
                userToken.UsedAt = DateTime.UtcNow;
                await _unitOfWork.SaveChangesAsync(CancellationToken.None);
                _logger.LogError("Lỗi gửi email mã đặt lại mật khẩu tới UserId {UserId}: {Error}",
                    user.UserId, emailResult.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            // A code that was never delivered must not remain usable. The generic
            // response below still prevents account enumeration.
            userToken.UsedAt = DateTime.UtcNow;
            try
            {
                await _unitOfWork.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception saveException)
            {
                _logger.LogError(saveException, "Không thể vô hiệu hóa OTP chưa gửi cho UserId {UserId}", user.UserId);
            }
            _logger.LogError(ex, "Lỗi gửi email mã đặt lại mật khẩu tới UserId {UserId}", user.UserId);
        }

        // 9. Trả về phản hồi an toàn
        return new ForgotPasswordResponse();
    }
}
