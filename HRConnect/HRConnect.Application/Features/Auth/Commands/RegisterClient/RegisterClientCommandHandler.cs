using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.RegisterClient;

public class RegisterClientCommandHandler : IRequestHandler<RegisterClientCommand, RegisterClientResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ICompanyVerificationRequestRepository _companyVerificationRequestRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IEmailOutboxRepository _emailOutboxRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IOtpService _otpService;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IEmailService _emailService;
    private readonly AuthenticationSettings _authSettings;
    private readonly ILogger<RegisterClientCommandHandler> _logger;

    public RegisterClientCommandHandler(
        IUserRepository userRepository,
        ICompanyRepository companyRepository,
        ICompanyUserRepository companyUserRepository,
        ICompanyVerificationRequestRepository companyVerificationRequestRepository,
        IUserTokenRepository userTokenRepository,
        IEmailOutboxRepository emailOutboxRepository,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IOtpService otpService,
        IPhoneNormalizer phoneNormalizer,
        IEmailNormalizer emailNormalizer,
        IEmailService emailService,
        IOptions<AuthenticationSettings> authOptions,
        ILogger<RegisterClientCommandHandler> logger)
    {
        _userRepository = userRepository;
        _companyRepository = companyRepository;
        _companyUserRepository = companyUserRepository;
        _companyVerificationRequestRepository = companyVerificationRequestRepository;
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

    public async Task<RegisterClientResponse> Handle(RegisterClientCommand request, CancellationToken cancellationToken)
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
            _logger.LogWarning("Đăng ký Client thất bại: Email {Email} đã tồn tại trong hệ thống.", normalizedEmail);
            throw new ConflictException("Email này đã được sử dụng bởi một tài khoản khác.");
        }

        // 3. Nếu có mã số thuế, kiểm tra trùng TaxCode trong hệ thống doanh nghiệp
        if (!string.IsNullOrWhiteSpace(request.TaxCode))
        {
            var taxCodeExists = await _companyRepository.ExistsByTaxCodeAsync(request.TaxCode.Trim(), cancellationToken);
            if (taxCodeExists)
            {
                _logger.LogWarning("Đăng ký Client thất bại: Mã số thuế {TaxCode} đã tồn tại trong hệ thống.", request.TaxCode);
                throw new ConflictException("Mã số thuế này đã được đăng ký bởi một doanh nghiệp khác.");
            }
        }

        // 4. Bắt đầu Database Transaction nguyên tử
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var now = DateTime.UtcNow;

            // 5. Tạo mới AppUser (status = PENDING, email_verified_at = null)
            // QUY TẮC: KHÔNG gán vai trò CLIENT_COMPANY_USER tại thời điểm đăng ký
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

            // 6. Tạo mới bản ghi Company (status = PENDING)
            var newCompany = new Company
            {
                CompanyId = Guid.NewGuid(),
                CompanyName = request.CompanyName.Trim(),
                TaxCode = request.TaxCode?.Trim(),
                VerificationStatus = "PENDING",
                CreatedAt = now,
                UpdatedAt = now
            };

            await _companyRepository.AddAsync(newCompany, cancellationToken);

            // 7. Tạo quan hệ CompanyUser (status = ACTIVE)
            var newCompanyUser = new CompanyUser
            {
                CompanyUserId = Guid.NewGuid(),
                CompanyId = newCompany.CompanyId,
                UserId = newUser.UserId,
                RoleInCompany = "Primary Contact",
                IsPrimaryContact = true,
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };

            await _companyUserRepository.AddAsync(newCompanyUser, cancellationToken);

            // 8. Tạo yêu cầu xác thực doanh nghiệp (company_verification_request)
            var verificationRequest = new CompanyVerificationRequest
            {
                CompanyVerificationRequestId = Guid.NewGuid(),
                CompanyId = newCompany.CompanyId,
                SubmittedBy = newUser.UserId,
                Status = "PENDING",
                SubmittedPayload = "{}",
                SubmittedAt = now
            };

            await _companyVerificationRequestRepository.AddAsync(verificationRequest, cancellationToken);

            // 9. Sinh mã OTP bảo mật và băm mã trước khi lưu
            var otpLength = _authSettings.Otp?.Length > 0 ? _authSettings.Otp.Length : 6;
            var expirationMinutes = _authSettings.Otp?.ExpirationMinutes > 0 ? _authSettings.Otp.ExpirationMinutes : 15;

            var rawOtp = _otpService.GenerateNumericOtp(otpLength);
            var otpHash = _otpService.HashOtp(rawOtp);

            _logger.LogInformation("===============================================================================");
            _logger.LogInformation("===> [DEV OTP] MÃ XÁC THỰC OTP CHO CLIENT {Email} LÀ: {Otp} <===", normalizedEmail, rawOtp);
            _logger.LogInformation("===============================================================================");

            // 10. Tạo bản ghi UserToken (loại EMAIL_OTP, lưu hash, không lưu raw OTP)
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

            // 11. Tạo bản ghi email_outbox
            var outboxPayload = JsonSerializer.Serialize(new
            {
                template = "CLIENT_REGISTRATION_OTP",
                userId = newUser.UserId,
                companyId = newCompany.CompanyId,
                expiresInMinutes = expirationMinutes
            });

            var emailOutbox = new EmailOutbox
            {
                EmailOutboxId = Guid.NewGuid(),
                UserId = newUser.UserId,
                RecipientEmail = newUser.Email,
                TemplateCode = "CLIENT_REGISTRATION_OTP",
                Subject = "Mã xác thực email đăng ký doanh nghiệp HRConnect",
                Payload = outboxPayload,
                Status = "PENDING",
                RetryCount = 0,
                CreatedAt = now
            };

            await _emailOutboxRepository.AddAsync(emailOutbox, cancellationToken);

            // 12. Commit Transaction
            await _unitOfWork.CommitTransactionAsync(cancellationToken);

            _logger.LogInformation("Đăng ký thành công tài khoản Client UserId {UserId}, Công ty {CompanyId}. Trạng thái: PENDING.",
                newUser.UserId, newCompany.CompanyId);

            // 13. Gửi email chứa raw OTP đến Client sau khi commit
            _ = Task.Run(async () =>
            {
                try
                {
                    var subject = "Mã xác thực đăng ký doanh nghiệp HRConnect";
                    var bodyHtml = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                            <h2 style='color: #4F46E5; margin-top: 0;'>Chào mừng doanh nghiệp đến với HRConnect!</h2>
                            <p>Xin chào <strong>{request.FullName.Trim()}</strong> (Đại diện <strong>{request.CompanyName.Trim()}</strong>),</p>
                            <p>Cảm ơn bạn đã đăng ký tài khoản Doanh nghiệp tuyển dụng trên nền tảng HRConnect. Để hoàn tất quy trình xác thực email, vui lòng sử dụng mã xác thực (OTP) dưới đây:</p>
                            <div style='background-color: #F3F4F6; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;'>
                                <span style='font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1F2937;'>{rawOtp}</span>
                            </div>
                            <p style='color: #4B5563; font-size: 14px;'>Mã xác thực này có hiệu lực trong vòng <strong>{expirationMinutes} phút</strong>. Sau khi xác thực email thành công, thông tin doanh nghiệp sẽ được chuyển đến Ban quản trị xem xét phê duyệt.</p>
                            <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                            <p style='color: #9CA3AF; font-size: 12px;'>Đây là email tự động từ hệ thống HRConnect. Vui lòng không trả lời thư này.</p>
                        </div>";

                    await _emailService.SendEmailAsync(newUser.Email, subject, bodyHtml, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi gửi email xác thực OTP tới Client {Email}", newUser.Email);
                }
            }, CancellationToken.None);

            // 14. Trả về kết quả HTTP 201 Created
            return new RegisterClientResponse
            {
                Success = true,
                Message = "Registration successful. Please verify your email.",
                Data = new RegisterClientData
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
