using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.ResendPasswordResetOtp;

public class ResendPasswordResetOtpCommandHandler : IRequestHandler<ResendPasswordResetOtpCommand, ResendPasswordResetOtpResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IEmailService _emailService;
    private readonly IOtpService _otpService;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IUnitOfWork _unitOfWork;
    private readonly AuthenticationSettings _authSettings;
    private readonly ILogger<ResendPasswordResetOtpCommandHandler> _logger;

    private const int ResendCooldownSeconds = 60;

    public ResendPasswordResetOtpCommandHandler(
        IUserRepository userRepository,
        IUserTokenRepository userTokenRepository,
        IEmailService emailService,
        IOtpService otpService,
        IEmailNormalizer emailNormalizer,
        IUnitOfWork unitOfWork,
        IOptions<AuthenticationSettings> authOptions,
        ILogger<ResendPasswordResetOtpCommandHandler> logger)
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

    public async Task<ResendPasswordResetOtpResponse> Handle(ResendPasswordResetOtpCommand request, CancellationToken cancellationToken)
    {
        // 1. Chuẩn hóa email
        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return new ResendPasswordResetOtpResponse();
        }

        // 2. Tìm người dùng theo email đã chuẩn hóa
        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);

        // 3. Phòng chống Account Enumeration: Luôn trả về phản hồi chung
        if (user == null)
        {
            _logger.LogInformation("Yêu cầu gửi lại mã OTP đặt lại mật khẩu cho email không tồn tại: {Email}", normalizedEmail);
            return new ResendPasswordResetOtpResponse();
        }

        // 4. Kiểm tra điều kiện đặt lại mật khẩu cục bộ (không hỗ trợ Google-only hoặc tài khoản bị khóa)
        var isGoogleOnly = string.IsNullOrWhiteSpace(user.PasswordHash) ||
                           user.PasswordHash.StartsWith("GOOGLE", StringComparison.OrdinalIgnoreCase);

        var isBlockedOrDeleted = string.Equals(user.Status, "BLOCKED", StringComparison.OrdinalIgnoreCase) ||
                                 string.Equals(user.Status, "DELETED", StringComparison.OrdinalIgnoreCase);

        if (isGoogleOnly || isBlockedOrDeleted)
        {
            _logger.LogWarning("Tài khoản {Email} không đủ điều kiện gửi lại mã OTP đặt lại mật khẩu (GoogleOnly: {IsGoogle}, Status: {Status})",
                normalizedEmail, isGoogleOnly, user.Status);
            return new ResendPasswordResetOtpResponse();
        }

        // 5. Kiểm tra thời gian chờ (cooldown/rate-limit) để chống spam email
        var latestActiveToken = await _userTokenRepository.GetLatestActiveOtpAsync(user.UserId, "PASSWORD_RESET", cancellationToken);
        if (latestActiveToken != null)
        {
            var secondsSinceLastOtp = (DateTime.UtcNow - latestActiveToken.CreatedAt).TotalSeconds;
            if (secondsSinceLastOtp < ResendCooldownSeconds)
            {
                _logger.LogInformation("UserId {UserId} yêu cầu gửi lại OTP trong thời gian chờ cooldown ({Seconds:F0}s / {Cooldown}s). Bỏ qua sinh mã mới để chống spam.",
                    user.UserId, secondsSinceLastOtp, ResendCooldownSeconds);
                return new ResendPasswordResetOtpResponse();
            }
        }

        // 6. Thu hồi / Vô hiệu hóa toàn bộ mã OTP PASSWORD_RESET trước đó
        await _userTokenRepository.InvalidateActiveTokensAsync(user.UserId, "PASSWORD_RESET", cancellationToken);

        // 7. Sinh mã OTP mới bảo mật và băm mã
        var otpLength = _authSettings.Otp?.Length > 0 ? _authSettings.Otp.Length : 6;
        var expirationMinutes = _authSettings.Otp?.ExpirationMinutes > 0 ? _authSettings.Otp.ExpirationMinutes : 15;

        var rawOtp = _otpService.GenerateNumericOtp(otpLength);
        var otpHash = _otpService.HashOtp(rawOtp);
        var now = DateTime.UtcNow;

        _logger.LogInformation("Đã sinh lại mã OTP đặt lại mật khẩu mới cho UserId {UserId}, Email {Email}. Thời hạn {Minutes} phút.",
            user.UserId, normalizedEmail, expirationMinutes);

        // 8. Tạo bản ghi UserToken mới
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

        // 9. Gửi email chứa mã OTP đặt lại mật khẩu mới
        _ = Task.Run(async () =>
        {
            try
            {
                var subject = "HR Connect - Mã xác thực đặt lại mật khẩu mới";
                var recipientName = string.IsNullOrWhiteSpace(user.DisplayName) ? "bạn" : user.DisplayName.Trim();
                var bodyHtml = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #4F46E5; margin-top: 0;'>HR Connect - Mã đặt lại mật khẩu mới</h2>
                        <p>Xin chào <strong>{recipientName}</strong>,</p>
                        <p>Bạn vừa yêu cầu gửi lại mã xác thực (OTP) đặt lại mật khẩu cho tài khoản HR Connect. Mã OTP mới của bạn là:</p>
                        <div style='background-color: #F3F4F6; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;'>
                            <span style='font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1F2937;'>{rawOtp}</span>
                        </div>
                        <p style='color: #4B5563; font-size: 14px;'>Mã xác thực mới này có hiệu lực trong vòng <strong>{expirationMinutes} phút</strong>. Các mã OTP cũ trước đó đã bị vô hiệu hóa.</p>
                        <p style='color: #4B5563; font-size: 14px;'>Tuyệt đối không chia sẻ mã xác thực cho bất kỳ ai. Nếu bạn không yêu cầu, vui lòng bỏ qua thư này.</p>
                        <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                        <p style='color: #9CA3AF; font-size: 12px;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p>
                    </div>";

                await _emailService.SendEmailAsync(user.Email, subject, bodyHtml, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi gửi email cấp lại mã OTP đặt lại mật khẩu tới {Email}", user.Email);
            }
        }, CancellationToken.None);

        // 10. Trả về phản hồi an toàn
        return new ResendPasswordResetOtpResponse();
    }
}
