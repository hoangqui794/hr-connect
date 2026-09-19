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
    private readonly IAffiliateApplicationRepository _affiliateApplicationRepository;
    private readonly ICompanyVerificationRequestRepository _companyVerificationRequestRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IEmailService _emailService;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IOtpService _otpService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<VerifyEmailOtpCommandHandler> _logger;

    public VerifyEmailOtpCommandHandler(
        IUserRepository userRepository,
        IUserTokenRepository userTokenRepository,
        IAffiliateApplicationRepository affiliateApplicationRepository,
        ICompanyVerificationRequestRepository companyVerificationRequestRepository,
        ICompanyRepository companyRepository,
        IEmailService emailService,
        IEmailNormalizer emailNormalizer,
        IOtpService otpService,
        IUnitOfWork unitOfWork,
        ILogger<VerifyEmailOtpCommandHandler> logger)
    {
        _userRepository = userRepository;
        _userTokenRepository = userTokenRepository;
        _affiliateApplicationRepository = affiliateApplicationRepository;
        _companyVerificationRequestRepository = companyVerificationRequestRepository;
        _companyRepository = companyRepository;
        _emailService = emailService;
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
        if (user.EmailVerifiedAt != null)
        {
            var isCandidate = user.Status == "ACTIVE";
            var statusToReturn = isCandidate ? "ACTIVE" : "PENDING_ADMIN_APPROVAL";
            var msgToReturn = isCandidate
                ? "Tài khoản của bạn đã được xác thực email từ trước đó. Bạn có thể đăng nhập ngay."
                : "Email của bạn đã được xác thực thành công và hồ sơ đang chờ Quản trị viên phê duyệt.";

            return new VerifyEmailOtpResponse
            {
                Success = true,
                Message = msgToReturn,
                Data = new VerifyEmailOtpData
                {
                    UserId = user.UserId,
                    Email = user.Email,
                    Status = statusToReturn,
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

        // 8. Đánh dấu used_at cho token
        var now = DateTime.UtcNow;
        token.UsedAt = now;
        _userTokenRepository.Update(token);

        user.EmailVerifiedAt = now;
        user.UpdatedAt = now;

        // 9. Nhận diện loại tài khoản để áp dụng nghiệp vụ tương ứng:
        // Case A: Người dùng đăng ký Affiliate Recruiter
        var affiliateApp = await _affiliateApplicationRepository.GetByUserIdAsync(user.UserId, cancellationToken);
        if (affiliateApp != null)
        {
            // QUY TẮC QUAN TRỌNG:
            // 1. Giữ user.Status = "PENDING"
            // 2. KHÔNG gán vai trò AFFILIATE_RECRUITER
            // 3. affiliate_application.status = "UNDER_REVIEW"
            user.Status = "PENDING";
            affiliateApp.Status = "UNDER_REVIEW";
            _affiliateApplicationRepository.Update(affiliateApp);
            _userRepository.Update(user);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Xác thực email thành công cho Affiliate UserId {UserId}. Hồ sơ chuyển sang UNDER_REVIEW chờ Admin duyệt.",
                user.UserId);

            // Gửi email xác nhận tiếp nhận hồ sơ Affiliate (Stage 2)
            _ = Task.Run(async () =>
            {
                try
                {
                    var subject = "HR Connect - Đã tiếp nhận hồ sơ đăng ký Đối tác tuyển dụng";
                    var bodyHtml = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                            <h2 style='color: #4F46E5; margin-top: 0;'>HR Connect - Đối tác tuyển dụng</h2>
                            <p>Cảm ơn bạn đã đăng ký trở thành Đối tác tuyển dụng (Affiliate Recruiter) trên hệ thống HR Connect.</p>
                            <p>Địa chỉ email của bạn đã được xác thực thành công.</p>
                            <p><strong>Hồ sơ đăng ký của bạn hiện đang chờ Ban quản trị hệ thống xem xét và phê duyệt.</strong></p>
                            <p>Chúng tôi sẽ gửi email thông báo kết quả ngay sau khi hồ sơ của bạn được xử lý.</p>
                            <p>Cảm ơn sự hợp tác và kiên nhẫn của bạn.</p>
                            <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                            <p style='color: #9CA3AF; font-size: 12px;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p>
                        </div>";

                    await _emailService.SendEmailAsync(user.Email, subject, bodyHtml, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi gửi email tiếp nhận hồ sơ Affiliate tới {Email}", user.Email);
                }
            }, CancellationToken.None);

            return new VerifyEmailOtpResponse
            {
                Success = true,
                Message = "Email verified successfully. Your Affiliate registration is pending Admin approval.",
                Data = new VerifyEmailOtpData
                {
                    UserId = user.UserId,
                    Email = user.Email,
                    Status = "PENDING_ADMIN_APPROVAL",
                    EmailVerifiedAt = now
                }
            };
        }

        // Case B: Người dùng đăng ký Client Company
        var companyVerification = await _companyVerificationRequestRepository.GetByUserIdAsync(user.UserId, cancellationToken);
        if (companyVerification != null)
        {
            // QUY TẮC QUAN TRỌNG:
            // 1. Giữ user.Status = "PENDING"
            // 2. KHÔNG gán vai trò CLIENT_COMPANY_USER
            // 3. company_verification_request.status = "UNDER_REVIEW"
            // 4. company.verification_status = "UNDER_REVIEW"
            user.Status = "PENDING";
            companyVerification.Status = "UNDER_REVIEW";
            _companyVerificationRequestRepository.Update(companyVerification);

            var company = await _companyRepository.GetByIdAsync(companyVerification.CompanyId, cancellationToken);
            if (company != null)
            {
                company.VerificationStatus = "UNDER_REVIEW";
                company.UpdatedAt = now;
                _companyRepository.Update(company);
            }

            _userRepository.Update(user);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Xác thực email thành công cho Client UserId {UserId}, Company {CompanyId}. Chờ Admin duyệt.",
                user.UserId, companyVerification.CompanyId);

            // Gửi email xác nhận tiếp nhận hồ sơ Doanh nghiệp (Stage 2)
            _ = Task.Run(async () =>
            {
                try
                {
                    var subject = "HR Connect - Đã tiếp nhận hồ sơ đăng ký Doanh nghiệp";
                    var bodyHtml = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                            <h2 style='color: #4F46E5; margin-top: 0;'>HR Connect - Đăng ký Doanh nghiệp</h2>
                            <p>Cảm ơn bạn đã đăng ký tài khoản Doanh nghiệp tuyển dụng trên hệ thống HR Connect.</p>
                            <p>Địa chỉ email của bạn đã được xác thực thành công.</p>
                            <p><strong>Hồ sơ xác thực doanh nghiệp của bạn hiện đang chờ Ban quản trị hệ thống xem xét và phê duyệt.</strong></p>
                            <p>Chúng tôi sẽ gửi email thông báo kết quả ngay sau khi hồ sơ được xét duyệt.</p>
                            <p>Cảm ơn sự hợp tác và kiên nhẫn của bạn.</p>
                            <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                            <p style='color: #9CA3AF; font-size: 12px;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p>
                        </div>";

                    await _emailService.SendEmailAsync(user.Email, subject, bodyHtml, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi gửi email tiếp nhận hồ sơ Doanh nghiệp tới {Email}", user.Email);
                }
            }, CancellationToken.None);

            return new VerifyEmailOtpResponse
            {
                Success = true,
                Message = "Email verified successfully. Your company registration is pending Admin approval.",
                Data = new VerifyEmailOtpData
                {
                    UserId = user.UserId,
                    Email = user.Email,
                    Status = "PENDING_ADMIN_APPROVAL",
                    EmailVerifiedAt = now
                }
            };
        }

        // Case C: Tài khoản Candidate (Ứng viên)
        user.Status = "ACTIVE";
        _userRepository.Update(user);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Xác thực email thành công cho Candidate UserId {UserId}, Email {Email}. Tài khoản đã chuyển sang ACTIVE.",
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
