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
    private readonly IUserEmailIdentityRepository _userEmailIdentityRepository;
    private readonly IAffiliateApplicationRepository _affiliateApplicationRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IEmailOutboxRepository _emailOutboxRepository;
    private readonly IAuditLogService _auditLogService;
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
        IUserEmailIdentityRepository userEmailIdentityRepository,
        IAffiliateApplicationRepository affiliateApplicationRepository,
        IUserTokenRepository userTokenRepository,
        IEmailOutboxRepository emailOutboxRepository,
        IAuditLogService auditLogService,
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
        _userEmailIdentityRepository = userEmailIdentityRepository;
        _affiliateApplicationRepository = affiliateApplicationRepository;
        _userTokenRepository = userTokenRepository;
        _emailOutboxRepository = emailOutboxRepository;
        _auditLogService = auditLogService;
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
            var existingUser = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);
            if (existingUser != null &&
                existingUser.EmailVerifiedAt == null &&
                string.Equals(existingUser.Status, "PENDING", StringComparison.OrdinalIgnoreCase))
            {
                throw new ConflictException(
                    "Email đang chờ xác thực. Vui lòng quay lại màn hình nhập OTP và bấm gửi lại mã nếu mã cũ đã hết hạn.",
                    "EMAIL_PENDING_VERIFICATION");
            }

            _logger.LogWarning("Đăng ký Affiliate thất bại: Email {Email} đã tồn tại trong hệ thống.", normalizedEmail);
            throw new ConflictException("Email này đã được sử dụng bởi một tài khoản khác.");
        }

        if (await _userEmailIdentityRepository.ExistsActiveByNormalizedEmailAsync(normalizedEmail, cancellationToken))
        {
            _logger.LogWarning("Đăng ký Affiliate thất bại: Email đã thuộc một danh tính tài khoản đang hoạt động.");
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
            await _userEmailIdentityRepository.AddAsync(new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = newUser.UserId,
                Email = newUser.Email,
                NormalizedEmail = normalizedEmail,
                Kind = "PRIMARY",
                Status = "PENDING",
                VerificationSource = "REGISTRATION",
                CreatedAt = now,
                UpdatedAt = now,
                ConcurrencyToken = Guid.NewGuid()
            }, cancellationToken);

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

            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.AffiliateRegistered,
                EntityType = "AFFILIATE_APPLICATION",
                EntityId = affiliateApp.AffiliateApplicationId,
                NewValues = new { userId = newUser.UserId, status = "PENDING", accountType = "AFFILIATE" },
                Source = AuditSources.Api
            }, cancellationToken);

            // 9. Commit Transaction
            await _unitOfWork.CommitTransactionAsync(cancellationToken);

            _logger.LogInformation("Đăng ký thành công tài khoản Affiliate UserId {UserId}, Email {Email}. Trạng thái: PENDING.",
                newUser.UserId, newUser.Email);

            // 10. Chờ nhà cung cấp email phản hồi để không làm mất tác vụ khi request kết thúc.
            // Raw OTP chỉ tồn tại trong bộ nhớ và không được ghi vào log/outbox.
            try
            {
                var email = HRConnect.Application.Common.Email.HrConnectEmailTemplates.RegistrationOtp(
                    request.FullName, rawOtp, expirationMinutes, "Đối tác tuyển dụng", true);
                var emailResult = await _emailService.SendEmailAsync(
                    newUser.Email, email.Subject, email.HtmlBody, CancellationToken.None);

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
                Message = "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
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
