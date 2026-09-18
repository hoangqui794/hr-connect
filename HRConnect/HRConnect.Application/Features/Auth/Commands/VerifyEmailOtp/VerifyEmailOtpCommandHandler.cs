using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp;

public class VerifyEmailOtpCommandHandler : IRequestHandler<VerifyEmailOtpCommand, VerifyEmailOtpResponse>
{
    private const int MaxFailedAttempts = 5;

    private readonly IUserRepository _userRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IOtpService _otpService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<VerifyEmailOtpCommandHandler> _logger;

    public VerifyEmailOtpCommandHandler(
        IUserRepository userRepository,
        IUserTokenRepository userTokenRepository,
        IEmailNormalizer emailNormalizer,
        IOtpService otpService,
        IUnitOfWork unitOfWork,
        ILogger<VerifyEmailOtpCommandHandler> logger)
    {
        _userRepository = userRepository;
        _userTokenRepository = userTokenRepository;
        _emailNormalizer = emailNormalizer;
        _otpService = otpService;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<VerifyEmailOtpResponse> Handle(VerifyEmailOtpCommand request, CancellationToken cancellationToken)
    {
        // 1. Chuẩn hóa email
        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            throw new BadRequestException("Email không hợp lệ.");
        }

        // 2. Tìm tài khoản AppUser theo email
        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("Xác thực thất bại: Không tìm thấy tài khoản cho email {Email}", normalizedEmail);
            throw new BadRequestException("Không tìm thấy tài khoản tương ứng với email này.");
        }

        // 3. Kiểm tra nếu tài khoản đã được xác thực trước đó
        if (user.EmailVerifiedAt != null && user.Status == "ACTIVE")
        {
            return new VerifyEmailOtpResponse
            {
                Success = true,
                Message = "Tài khoản của bạn đã được xác thực email từ trước đó. Bạn có thể đăng nhập ngay.",
                Data = new VerifyEmailOtpData
                {
                    UserId = user.UserId,
                    Email = user.Email,
                    Status = user.Status,
                    EmailVerifiedAt = user.EmailVerifiedAt.Value
                }
            };
        }

        // 4. Lấy mã OTP khả dụng gần nhất (token_type = "EMAIL_OTP", used_at IS NULL)
        var token = await _userTokenRepository.GetLatestActiveOtpAsync(user.UserId, "EMAIL_OTP", cancellationToken);
        if (token == null)
        {
            _logger.LogWarning("Xác thực thất bại: Không tìm thấy token OTP active cho UserId {UserId}", user.UserId);
            throw new BadRequestException("Mã OTP không tồn tại hoặc đã được sử dụng. Vui lòng yêu cầu mã mới.");
        }

        // 5. Kiểm tra phòng chống Brute-force (tối đa 5 lần thử)
        if (token.AttemptCount >= MaxFailedAttempts)
        {
            _logger.LogWarning("UserId {UserId} đã vượt quá số lần thử OTP cho phép ({Attempts}/{Max})", 
                user.UserId, token.AttemptCount, MaxFailedAttempts);
            throw new BadRequestException("Bạn đã nhập sai mã OTP quá 5 lần. Mã xác thực này đã bị khóa. Vui lòng yêu cầu mã OTP mới.");
        }

        // 6. Kiểm tra hạn sử dụng của OTP
        if (DateTime.UtcNow > token.ExpiresAt)
        {
            _logger.LogWarning("UserId {UserId} sử dụng mã OTP đã hết hạn (Hết hạn lúc: {ExpiresAt})", 
                user.UserId, token.ExpiresAt);
            throw new BadRequestException("Mã OTP đã hết hạn. Vui lòng yêu cầu mã xác thực mới.");
        }

        // 7. So khớp mã OTP với chuỗi băm trong cơ sở dữ liệu
        var isOtpValid = _otpService.VerifyOtp(request.Otp.Trim(), token.TokenHash);
        if (!isOtpValid)
        {
            token.AttemptCount += 1;
            _userTokenRepository.Update(token);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var remainingAttempts = MaxFailedAttempts - token.AttemptCount;
            _logger.LogWarning("UserId {UserId} nhập sai OTP. Số lần thử còn lại: {Remaining}", 
                user.UserId, remainingAttempts);

            if (remainingAttempts <= 0)
            {
                throw new BadRequestException("Mã OTP không chính xác. Bạn đã hết số lần thử. Mã này đã bị vô hiệu hóa.");
            }

            throw new BadRequestException($"Mã OTP không chính xác. Bạn còn {remainingAttempts} lần thử lại.");
        }

        // 8. Xác thực thành công: Đánh dấu used_at, kích hoạt trạng thái ACTIVE
        var now = DateTime.UtcNow;
        token.UsedAt = now;
        _userTokenRepository.Update(token);

        user.EmailVerifiedAt = now;
        user.Status = "ACTIVE";
        user.UpdatedAt = now;
        _userRepository.Update(user);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Xác thực email thành công cho UserId {UserId}, Email {Email}. Tài khoản đã chuyển sang ACTIVE.", 
            user.UserId, user.Email);

        return new VerifyEmailOtpResponse
        {
            Success = true,
            Message = "Xác thực email thành công! Tài khoản của bạn đã được kích hoạt.",
            Data = new VerifyEmailOtpData
            {
                UserId = user.UserId,
                Email = user.Email,
                Status = user.Status,
                EmailVerifiedAt = now
            }
        };
    }
}
