using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Auth.Commands.ResetPassword;

public class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand, ResetPasswordResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IOtpService _otpService;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ResetPasswordCommandHandler> _logger;

    private const int MaxFailedAttempts = 5;
    private const string GenericErrorMessage = "Mã xác thực đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.";

    public ResetPasswordCommandHandler(
        IUserRepository userRepository,
        IUserTokenRepository userTokenRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IPasswordHasher passwordHasher,
        IOtpService otpService,
        IEmailNormalizer emailNormalizer,
        IUnitOfWork unitOfWork,
        ILogger<ResetPasswordCommandHandler> logger)
    {
        _userRepository = userRepository;
        _userTokenRepository = userTokenRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _passwordHasher = passwordHasher;
        _otpService = otpService;
        _emailNormalizer = emailNormalizer;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ResetPasswordResponse> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        // 1. Chuẩn hóa email
        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            throw new BadRequestException(GenericErrorMessage);
        }

        // 2. Tìm người dùng
        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("Đặt lại mật khẩu thất bại: Email không tồn tại: {Email}", normalizedEmail);
            throw new BadRequestException(GenericErrorMessage);
        }

        // 3. Kiểm tra tính hợp lệ của tài khoản (không hỗ trợ tài khoản Google-only hoặc bị khóa)
        var isGoogleOnly = string.IsNullOrWhiteSpace(user.PasswordHash) ||
                           user.PasswordHash.StartsWith("GOOGLE", StringComparison.OrdinalIgnoreCase);

        var isBlockedOrDeleted = string.Equals(user.Status, "BLOCKED", StringComparison.OrdinalIgnoreCase) ||
                                 string.Equals(user.Status, "DELETED", StringComparison.OrdinalIgnoreCase);

        if (isGoogleOnly || isBlockedOrDeleted)
        {
            _logger.LogWarning("Đặt lại mật khẩu thất bại: Tài khoản {Email} không đủ điều kiện (GoogleOnly: {IsGoogle}, Status: {Status})",
                normalizedEmail, isGoogleOnly, user.Status);
            throw new BadRequestException(GenericErrorMessage);
        }

        // 4. Lấy token OTP active cho mục đích PASSWORD_RESET
        var token = await _userTokenRepository.GetLatestActiveOtpAsync(user.UserId, "PASSWORD_RESET", cancellationToken);
        if (token == null)
        {
            _logger.LogWarning("Đặt lại mật khẩu thất bại: Không tìm thấy token active cho UserId {UserId}", user.UserId);
            throw new BadRequestException(GenericErrorMessage);
        }

        // 5. Kiểm tra phòng chống Brute-force
        if (token.AttemptCount >= MaxFailedAttempts)
        {
            _logger.LogWarning("UserId {UserId} đã vượt quá số lần thử OTP đặt lại mật khẩu ({Attempts}/{Max})",
                user.UserId, token.AttemptCount, MaxFailedAttempts);
            throw new BadRequestException("Bạn đã nhập sai mã xác thực quá 5 lần. Mã này đã bị vô hiệu hóa. Vui lòng yêu cầu mã OTP mới.");
        }

        // 6. Kiểm tra hạn sử dụng của OTP
        if (DateTime.UtcNow > token.ExpiresAt)
        {
            _logger.LogWarning("UserId {UserId} sử dụng OTP đặt lại mật khẩu đã hết hạn (Hết hạn lúc: {ExpiresAt})",
                user.UserId, token.ExpiresAt);
            throw new BadRequestException(GenericErrorMessage);
        }

        // 7. So khớp mã OTP với chuỗi băm trong cơ sở dữ liệu
        var isOtpValid = _otpService.VerifyOtp(request.Otp.Trim(), token.TokenHash);
        if (!isOtpValid)
        {
            token.AttemptCount += 1;
            _userTokenRepository.Update(token);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogWarning("UserId {UserId} nhập sai OTP đặt lại mật khẩu. Lần thử thứ: {Attempt}",
                user.UserId, token.AttemptCount);

            if (token.AttemptCount >= MaxFailedAttempts)
            {
                throw new BadRequestException("Bạn đã nhập sai mã xác thực quá 5 lần. Mã này đã bị vô hiệu hóa. Vui lòng yêu cầu mã OTP mới.");
            }

            throw new BadRequestException(GenericErrorMessage);
        }

        // 8. Kiểm tra mật khẩu mới không được trùng với mật khẩu hiện tại
        if (_passwordHasher.Verify(request.NewPassword, user.PasswordHash))
        {
            throw new BadRequestException("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
        }

        // 9. Thực hiện cập nhật mật khẩu trong Transaction nguyên tử (Atomic Transaction)
        var now = DateTime.UtcNow;

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            // 9.1 Băm và cập nhật mật khẩu mới cho tài khoản
            user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
            user.UpdatedAt = now;
            _userRepository.Update(user);

            // 9.2 Đánh dấu token đã được sử dụng
            token.UsedAt = now;
            _userTokenRepository.Update(token);

            // 9.3 Vô hiệu hóa bất kỳ token PASSWORD_RESET nào còn sót lại
            await _userTokenRepository.InvalidateActiveTokensAsync(user.UserId, "PASSWORD_RESET", cancellationToken);

            // 9.4 Thu hồi toàn bộ Refresh Token / phiên đăng nhập hiện tại
            await _refreshTokenRepository.RevokeAllByUserIdAsync(user.UserId, "PASSWORD_RESET", cancellationToken);

            // 9.5 Lưu và commit transaction
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi xảy ra trong giao dịch đặt lại mật khẩu cho UserId {UserId}", user.UserId);
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        _logger.LogInformation("Đặt lại mật khẩu thành công cho UserId {UserId}, Email {Email}. Đã thu hồi toàn bộ Refresh Tokens.",
            user.UserId, normalizedEmail);

        return new ResetPasswordResponse();
    }
}
