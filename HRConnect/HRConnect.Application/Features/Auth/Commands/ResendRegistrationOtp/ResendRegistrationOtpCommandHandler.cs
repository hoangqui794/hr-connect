using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.ResendRegistrationOtp;

public class ResendRegistrationOtpCommandHandler
    : IRequestHandler<ResendRegistrationOtpCommand, ResendRegistrationOtpResponse>
{
    private const int ResendCooldownSeconds = 60;

    private readonly IUserRepository _userRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IEmailService _emailService;
    private readonly IOtpService _otpService;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IUnitOfWork _unitOfWork;
    private readonly AuthenticationSettings _authSettings;
    private readonly ILogger<ResendRegistrationOtpCommandHandler> _logger;

    public ResendRegistrationOtpCommandHandler(
        IUserRepository userRepository,
        IUserTokenRepository userTokenRepository,
        IEmailService emailService,
        IOtpService otpService,
        IEmailNormalizer emailNormalizer,
        IUnitOfWork unitOfWork,
        IOptions<AuthenticationSettings> authOptions,
        ILogger<ResendRegistrationOtpCommandHandler> logger)
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

    public async Task<ResendRegistrationOtpResponse> Handle(
        ResendRegistrationOtpCommand request,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return new ResendRegistrationOtpResponse();
        }

        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);
        if (user == null ||
            user.EmailVerifiedAt != null ||
            !string.Equals(user.Status, "PENDING", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation(
                "Bỏ qua yêu cầu gửi lại OTP đăng ký cho email không tồn tại hoặc không còn chờ xác thực.");
            return new ResendRegistrationOtpResponse();
        }

        var latestToken = await _userTokenRepository.GetLatestActiveOtpAsync(
            user.UserId,
            "EMAIL_OTP",
            cancellationToken);

        if (latestToken != null &&
            (DateTime.UtcNow - latestToken.CreatedAt).TotalSeconds < ResendCooldownSeconds)
        {
            return new ResendRegistrationOtpResponse();
        }

        await _userTokenRepository.InvalidateActiveTokensAsync(user.UserId, "EMAIL_OTP", cancellationToken);

        var otpLength = _authSettings.Otp?.Length > 0 ? _authSettings.Otp.Length : 6;
        var expirationMinutes = _authSettings.Otp?.ExpirationMinutes > 0
            ? _authSettings.Otp.ExpirationMinutes
            : 15;
        var rawOtp = _otpService.GenerateNumericOtp(otpLength);
        var now = DateTime.UtcNow;
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenType = "EMAIL_OTP",
            TokenHash = _otpService.HashOtp(rawOtp),
            ExpiresAt = now.AddMinutes(expirationMinutes),
            AttemptCount = 0,
            CreatedAt = now
        };

        await _userTokenRepository.AddAsync(token, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var recipientName = string.IsNullOrWhiteSpace(user.DisplayName) ? "bạn" : user.DisplayName.Trim();
        var subject = "HR Connect - Mã xác thực đăng ký mới";
        var bodyHtml = $@"
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
                <h2 style='color: #4F46E5;'>Xác thực email đăng ký HR Connect</h2>
                <p>Xin chào <strong>{recipientName}</strong>,</p>
                <p>Mã OTP đăng ký mới của bạn là:</p>
                <div style='background-color: #F3F4F6; padding: 16px; text-align: center;'>
                    <span style='font-size: 32px; font-weight: bold; letter-spacing: 6px;'>{rawOtp}</span>
                </div>
                <p>Mã có hiệu lực trong <strong>{expirationMinutes} phút</strong>. Các mã cũ đã bị vô hiệu hóa.</p>
            </div>";

        var emailResult = await _emailService.SendEmailAsync(user.Email, subject, bodyHtml, cancellationToken);
        if (!emailResult.IsSuccess)
        {
            token.UsedAt = DateTime.UtcNow;
            _userTokenRepository.Update(token);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            _logger.LogError("Không thể gửi lại OTP đăng ký cho UserId {UserId}: {Error}",
                user.UserId, emailResult.ErrorMessage);
            throw new BadRequestException("Không thể gửi mã OTP lúc này. Vui lòng thử lại sau.");
        }

        _logger.LogInformation("Đã gửi lại OTP đăng ký cho UserId {UserId}.", user.UserId);
        return new ResendRegistrationOtpResponse();
    }
}
