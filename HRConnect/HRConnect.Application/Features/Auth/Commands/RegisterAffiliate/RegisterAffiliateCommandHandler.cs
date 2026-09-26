using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.RegisterAffiliate;

public class RegisterAffiliateCommandHandler : IRequestHandler<RegisterAffiliateCommand, RegisterAffiliateResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IAffiliateApplicationRepository _affiliateApplicationRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IEmailOutboxRepository _emailOutboxRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IOtpService _otpService;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IEmailService _emailService;
    private readonly AuthenticationSettings _authSettings;
    private readonly ILogger<RegisterAffiliateCommandHandler> _logger;

    public RegisterAffiliateCommandHandler(
        IUserRepository userRepository,
        IAffiliateApplicationRepository affiliateApplicationRepository,
        IUserTokenRepository userTokenRepository,
        IEmailOutboxRepository emailOutboxRepository,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IOtpService otpService,
        IPhoneNormalizer phoneNormalizer,
        IEmailNormalizer emailNormalizer,
        IEmailService emailService,
        IOptions<AuthenticationSettings> authOptions,
        ILogger<RegisterAffiliateCommandHandler> logger)
    {
        _userRepository = userRepository;
        _affiliateApplicationRepository = affiliateApplicationRepository;
        _userTokenRepository = userTokenRepository;
        _emailOutboxRepository = emailOutboxRepository;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _otpService = otpService;
        _phoneNormalizer = phoneNormalizer;
        _emailNormalizer = emailNormalizer;
        _emailService = emailService;
        _authSettings = authOptions.Value;
        _logger = logger;
    }

    public async Task<RegisterAffiliateResponse> Handle(RegisterAffiliateCommand request, CancellationToken cancellationToken)
    {
        // 1. Chuẩn hóa email và số điện thoại
        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        var normalizedPhone = _phoneNormalizer.Normalize(request.Phone);

        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            throw new BadRequestException("Email không hợp lệ.");
        }

        // 2. Kiểm tra nếu app_user đã tồn tại theo normalized email (case-insensitive)
        var userExists = await _userRepository.ExistsByEmailAsync(normalizedEmail, cancellationToken);
        if (userExists)
        {
            _logger.LogWarning("Đăng ký Affiliate thất bại: Email {Email} đã tồn tại trong hệ thống.", normalizedEmail);
            throw new ConflictException("Email này đã được sử dụng bởi một tài khoản khác.");
        }

        // 3. Bắt đầu Database Transaction nguyên tử
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var now = DateTime.UtcNow;

            // 4. Tạo mới AppUser (status = PENDING, email_verified_at = null)
            // QUY TẮC: KHÔNG gán vai trò AFFILIATE_RECRUITER tại thời điểm đăng ký
            var newUser = new AppUser
            {
                UserId = Guid.NewGuid(),
                Email = request.Email.Trim(),
                PasswordHash = _passwordHasher.Hash(request.Password),
                DisplayName = request.FullName.Trim(),
                Phone = request.Phone?.Trim(),
                NormalizedPhone = normalizedPhone,
                Status = "PENDING",
                EmailVerifiedAt = null,
                CreatedAt = now,
                UpdatedAt = now
            };

            await _userRepository.AddAsync(newUser, cancellationToken);

            // 5. Tạo đơn đăng ký Affiliate (affiliate_application)
            // Trạng thái DB tuân thủ CHECK constraint: 'PENDING'
            var affiliateApp = new AffiliateApplication
            {
                AffiliateApplicationId = Guid.NewGuid(),
                UserId = newUser.UserId,
                AffiliateType = "RECRUITER",
                DisplayName = request.FullName.Trim(),
                Phone = request.Phone?.Trim(),
                SubmittedData = "{}",
                Status = "PENDING",
                SubmittedAt = now
            };

            await _affiliateApplicationRepository.AddAsync(affiliateApp, cancellationToken);

            // 6. Sinh mã OTP bảo mật và băm mã trước khi lưu
            var otpLength = _authSettings.Otp?.Length > 0 ? _authSettings.Otp.Length : 6;
            var expirationMinutes = _authSettings.Otp?.ExpirationMinutes > 0 ? _authSettings.Otp.ExpirationMinutes : 15;

            var rawOtp = _otpService.GenerateNumericOtp(otpLength);
            var otpHash = _otpService.HashOtp(rawOtp);

            // 7. Tạo bản ghi UserToken (loại EMAIL_OTP, lưu hash, không lưu raw OTP)
            var userToken = new UserToken
            {
                TokenId = Guid.NewGuid(),
                UserId = newUser.UserId,
                TokenType = "EMAIL_OTP",
                TokenHash = otpHash,
                ExpiresAt = now.AddMinutes(expirationMinutes),
                UsedAt = null,
                AttemptCount = 0,
                CreatedAt = now
            };

            await _userTokenRepository.AddAsync(userToken, cancellationToken);

            // 8. Tạo bản ghi email_outbox
            var outboxPayload = JsonSerializer.Serialize(new
            {
                template = "AFFILIATE_REGISTRATION_OTP",
                userId = newUser.UserId,
                expiresInMinutes = expirationMinutes
            });

            var emailOutbox = new EmailOutbox
            {
                EmailOutboxId = Guid.NewGuid(),
                UserId = newUser.UserId,
                RecipientEmail = newUser.Email,
                TemplateCode = "AFFILIATE_REGISTRATION_OTP",
                Subject = "Mã xác thực email đăng ký đối tác tuyển dụng HRConnect",
                Payload = outboxPayload,
                Status = "PENDING",
                RetryCount = 0,
                CreatedAt = now
            };

            await _emailOutboxRepository.AddAsync(emailOutbox, cancellationToken);

            // 9. Commit Transaction
            await _unitOfWork.CommitTransactionAsync(cancellationToken);

            _logger.LogInformation("Đăng ký thành công tài khoản Affiliate UserId {UserId}, Email {Email}. Trạng thái: PENDING.",
                newUser.UserId, newUser.Email);

            // 10. Chờ nhà cung cấp email phản hồi để không làm mất tác vụ khi request kết thúc.
            // Raw OTP chỉ tồn tại trong bộ nhớ và không được ghi vào log/outbox.
            try
            {
                var subject = "Mã xác thực đăng ký Đối tác tuyển dụng - HR Connect";
                var bodyHtml = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #4F46E5; margin-top: 0;'>HR Connect - Đối tác tuyển dụng</h2>
                        <p>Xin chào <strong>{request.FullName.Trim()}</strong>,</p>
                        <p>Cảm ơn bạn đã đăng ký trở thành Đối tác tuyển dụng (Affiliate Recruiter) của HR Connect. Vui lòng sử dụng mã xác thực (OTP) dưới đây để xác nhận địa chỉ email của bạn:</p>
                        <div style='background-color: #F3F4F6; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;'>
                            <span style='font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1F2937;'>{rawOtp}</span>
                        </div>
                        <p style='color: #4B5563; font-size: 14px;'>Mã xác thực này có hiệu lực trong vòng <strong>{expirationMinutes} phút</strong>. Sau khi xác thực email, hồ sơ của bạn sẽ được chuyển đến Ban quản trị xem xét phê duyệt.</p>
                        <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                        <p style='color: #9CA3AF; font-size: 12px;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p>
                    </div>";

                var emailResult = await _emailService.SendEmailAsync(
                    newUser.Email, subject, bodyHtml, CancellationToken.None);

                if (emailResult.IsSuccess)
                {
                    emailOutbox.Status = "SENT";
                    emailOutbox.SentAt = DateTime.UtcNow;
                }
                else
                {
                    emailOutbox.Status = "FAILED";
                    emailOutbox.RetryCount += 1;
                    emailOutbox.LastError = emailResult.ErrorMessage;
                    _logger.LogError("Lỗi gửi email xác thực OTP Affiliate cho UserId {UserId}: {Error}",
                        newUser.UserId, emailResult.ErrorMessage);
                }

                await _unitOfWork.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception ex)
            {
                emailOutbox.Status = "FAILED";
                emailOutbox.RetryCount += 1;
                emailOutbox.LastError = ex.Message;
                try
                {
                    await _unitOfWork.SaveChangesAsync(CancellationToken.None);
                }
                catch (Exception saveException)
                {
                    _logger.LogError(saveException,
                        "Không thể cập nhật trạng thái email_outbox {OutboxId}", emailOutbox.EmailOutboxId);
                }

                _logger.LogError(ex, "Lỗi gửi email xác thực OTP Affiliate cho UserId {UserId}", newUser.UserId);
            }

            // 11. Trả về kết quả HTTP 201 Created
            return new RegisterAffiliateResponse
            {
                Success = true,
                Message = "Registration successful. Please verify your email.",
                Data = new RegisterAffiliateData
                {
                    UserId = newUser.UserId,
                    Email = newUser.Email,
                    Status = "PENDING_EMAIL_VERIFICATION"
                }
            };
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }
    }
}
