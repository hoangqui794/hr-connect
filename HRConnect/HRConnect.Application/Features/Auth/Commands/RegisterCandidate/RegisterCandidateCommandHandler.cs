using System.Net;
using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.RegisterCandidate;

public class RegisterCandidateCommandHandler : IRequestHandler<RegisterCandidateCommand, RegisterCandidateResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly ICandidateRepository _candidateRepository;
    private readonly IRoleRepository _roleRepository;
    private readonly IUserRoleRepository _userRoleRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IEmailOutboxRepository _emailOutboxRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IOtpService _otpService;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IEmailService _emailService;
    private readonly AuthenticationSettings _authSettings;
    private readonly ILogger<RegisterCandidateCommandHandler> _logger;

    public RegisterCandidateCommandHandler(
        IUserRepository userRepository,
        ICandidateRepository candidateRepository,
        IRoleRepository roleRepository,
        IUserRoleRepository userRoleRepository,
        IUserTokenRepository userTokenRepository,
        IEmailOutboxRepository emailOutboxRepository,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IOtpService otpService,
        IPhoneNormalizer phoneNormalizer,
        IEmailNormalizer emailNormalizer,
        IEmailService emailService,
        IOptions<AuthenticationSettings> authOptions,
        ILogger<RegisterCandidateCommandHandler> logger)
    {
        _userRepository = userRepository;
        _candidateRepository = candidateRepository;
        _roleRepository = roleRepository;
        _userRoleRepository = userRoleRepository;
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

    public async Task<RegisterCandidateResponse> Handle(RegisterCandidateCommand request, CancellationToken cancellationToken)
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
            _logger.LogWarning("Đăng ký thất bại: Email {Email} đã tồn tại trong hệ thống.", normalizedEmail);
            throw new ConflictException("Email này đã được sử dụng bởi một tài khoản khác.");
        }

        // 3. Kiểm tra danh tính Candidate hiện hữu (theo normalized_email hoặc normalized_phone)
        var existingCandidate = await _candidateRepository.FindByIdentityAsync(
            normalizedEmail, 
            normalizedPhone, 
            cancellationToken);

        // Nếu Candidate đã tồn tại và ĐÃ được liên kết với một tài khoản khác (user_id != null)
        if (existingCandidate != null && existingCandidate.UserId != null)
        {
            _logger.LogWarning("Đăng ký thất bại: Hồ sơ ứng viên ({Email} / {Phone}) đã liên kết với UserId {UserId}", 
                normalizedEmail, normalizedPhone, existingCandidate.UserId);
            throw new ConflictException("Hồ sơ ứng viên tương ứng với email hoặc số điện thoại này đã được liên kết với một tài khoản khác.");
        }

        // 4. Bắt đầu Database Transaction nguyên tử
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var now = DateTime.UtcNow;

            // 5. Tạo mới AppUser (status = PENDING, email_verified_at = null)
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

            // 6. Tìm role có code = CANDIDATE
            var candidateRole = await _roleRepository.GetByCodeAsync("CANDIDATE", cancellationToken);
            if (candidateRole == null)
            {
                _logger.LogError("Lỗi hệ thống: Không tìm thấy vai trò CANDIDATE trong bảng role.");
                throw new InvalidOperationException("Vai trò CANDIDATE chưa được thiết lập trong cơ sở dữ liệu.");
            }

            // 7. Gán vai trò CANDIDATE qua UserRole
            var userRole = new UserRole
            {
                UserId = newUser.UserId,
                RoleId = candidateRole.RoleId,
                AssignmentSource = "REGISTRATION",
                AssignedAt = now,
                Status = "ACTIVE"
            };

            await _userRoleRepository.AddAsync(userRole, cancellationToken);

            // 8. Xử lý hồ sơ Candidate:
            // - Nếu chưa có: tạo mới bản ghi Candidate gắn với UserId
            // - Nếu đã có (user_id == null): liên kết bản ghi hiện hữu với UserId mới
            if (existingCandidate == null)
            {
                var newCandidate = new Candidate
                {
                    CandidateId = Guid.NewGuid(),
                    UserId = newUser.UserId,
                    FullName = request.FullName.Trim(),
                    Email = request.Email.Trim(),
                    Phone = request.Phone?.Trim(),
                    NormalizedEmail = normalizedEmail,
                    NormalizedPhone = normalizedPhone,
                    ProfileVisibility = "PRIVATE",
                    Status = "ACTIVE",
                    CreatedAt = now,
                    UpdatedAt = now
                };

                await _candidateRepository.AddAsync(newCandidate, cancellationToken);
                _logger.LogInformation("Tạo mới hồ sơ CandidateId {CandidateId} liên kết với UserId {UserId}", 
                    newCandidate.CandidateId, newUser.UserId);
            }
            else
            {
                existingCandidate.UserId = newUser.UserId;
                existingCandidate.UpdatedAt = now;

                if (string.IsNullOrWhiteSpace(existingCandidate.FullName))
                {
                    existingCandidate.FullName = request.FullName.Trim();
                }
                if (string.IsNullOrWhiteSpace(existingCandidate.Email))
                {
                    existingCandidate.Email = request.Email.Trim();
                    existingCandidate.NormalizedEmail = normalizedEmail;
                }
                if (string.IsNullOrWhiteSpace(existingCandidate.Phone) && !string.IsNullOrWhiteSpace(request.Phone))
                {
                    existingCandidate.Phone = request.Phone.Trim();
                    existingCandidate.NormalizedPhone = normalizedPhone;
                }

                _candidateRepository.Update(existingCandidate);
                _logger.LogInformation("Liên kết hồ sơ ứng viên hiện hữu CandidateId {CandidateId} với UserId mới {UserId}", 
                    existingCandidate.CandidateId, newUser.UserId);
            }

            // 9. Sinh mã OTP bảo mật và băm mã trước khi lưu
            var otpLength = _authSettings.Otp?.Length > 0 ? _authSettings.Otp.Length : 6;
            var expirationMinutes = _authSettings.Otp?.ExpirationMinutes > 0 ? _authSettings.Otp.ExpirationMinutes : 15;

            var rawOtp = _otpService.GenerateNumericOtp(otpLength);
            var otpHash = _otpService.HashOtp(rawOtp);

            _logger.LogInformation("===============================================================================");
            _logger.LogInformation("===> [DEV OTP] MÃ XÁC THỰC OTP CHO {Email} LÀ: {Otp} <===", normalizedEmail, rawOtp);
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

            // 11. Tạo bản ghi email_outbox (an toàn, tuyệt đối không lưu raw OTP vào database)
            var outboxPayload = JsonSerializer.Serialize(new
            {
                template = "CANDIDATE_REGISTRATION_OTP",
                userId = newUser.UserId,
                expiresInMinutes = expirationMinutes
            });

            var emailOutbox = new EmailOutbox
            {
                EmailOutboxId = Guid.NewGuid(),
                UserId = newUser.UserId,
                RecipientEmail = newUser.Email,
                TemplateCode = "CANDIDATE_REGISTRATION_OTP",
                Subject = "Mã xác thực email đăng ký tài khoản HRConnect",
                Payload = outboxPayload,
                Status = "PENDING",
                RetryCount = 0,
                CreatedAt = now
            };

            await _emailOutboxRepository.AddAsync(emailOutbox, cancellationToken);

            // 12. Commit Transaction
            await _unitOfWork.CommitTransactionAsync(cancellationToken);

            _logger.LogInformation("Đăng ký thành công tài khoản ứng viên UserId {UserId}, Email {Email}. Trạng thái: PENDING.", 
                newUser.UserId, newUser.Email);

            // 13. Gửi email chứa raw OTP đến ứng viên sau khi commit thành công
            _ = Task.Run(async () =>
            {
                try
                {
                    var subject = "Mã xác thực tài khoản Ứng viên - HR Connect";
                    var bodyHtml = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                            <h2 style='color: #4F46E5; margin-top: 0;'>Chào mừng bạn đến với HR Connect!</h2>
                            <p>Xin chào <strong>{request.FullName.Trim()}</strong>,</p>
                            <p>Cảm ơn bạn đã đăng ký tài khoản Ứng viên trên hệ thống HR Connect. Để hoàn tất quy trình đăng ký, vui lòng sử dụng mã xác thực (OTP) dưới đây:</p>
                            <div style='background-color: #F3F4F6; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;'>
                                <span style='font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1F2937;'>{rawOtp}</span>
                            </div>
                            <p style='color: #4B5563; font-size: 14px;'>Mã xác thực này có hiệu lực trong vòng <strong>{expirationMinutes} phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
                            <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                            <p style='color: #9CA3AF; font-size: 12px;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p>
                        </div>";

                    await _emailService.SendEmailAsync(newUser.Email, subject, bodyHtml, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi gửi email xác thực OTP tới {Email}", newUser.Email);
                }
            }, CancellationToken.None);

            // 14. Trả về kết quả 201 Created (không chứa OTP trong response)
            return new RegisterCandidateResponse
            {
                Success = true,
                Message = "Registration successful. Please verify your email.",
                Data = new RegisterCandidateData
                {
                    UserId = newUser.UserId,
                    Email = newUser.Email,
                    Status = newUser.Status
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
