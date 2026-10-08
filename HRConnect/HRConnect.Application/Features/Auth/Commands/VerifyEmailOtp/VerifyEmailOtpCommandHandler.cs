using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using HRConnect.Application.Features.Auth.Common;

namespace HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp;

public class VerifyEmailOtpCommandHandler : IRequestHandler<VerifyEmailOtpCommand, VerifyEmailOtpResponse>
{
    private const int MaxFailedAttempts = 5;

    private readonly IUserRepository _userRepository;
    private readonly IUserEmailIdentityRepository _userEmailIdentityRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IAffiliateApplicationRepository _affiliateApplicationRepository;
    private readonly ICompanyVerificationRequestRepository _companyVerificationRequestRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IEmailOutboxRepository _emailOutboxRepository;
    private readonly IAuditLogService _auditLogService;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IOtpService _otpService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<VerifyEmailOtpCommandHandler> _logger;
    private readonly ICandidateRepository _candidateRepository;

    public VerifyEmailOtpCommandHandler(
        IUserRepository userRepository,
        IUserEmailIdentityRepository userEmailIdentityRepository,
        IUserTokenRepository userTokenRepository,
        IAffiliateApplicationRepository affiliateApplicationRepository,
        ICompanyVerificationRequestRepository companyVerificationRequestRepository,
        ICompanyRepository companyRepository,
        IEmailOutboxRepository emailOutboxRepository,
        IAuditLogService auditLogService,
        IEmailNormalizer emailNormalizer,
        IOtpService otpService,
        IUnitOfWork unitOfWork,
        ILogger<VerifyEmailOtpCommandHandler> logger,
        ICandidateRepository candidateRepository)
    {
        _userRepository = userRepository;
        _userEmailIdentityRepository = userEmailIdentityRepository;
        _userTokenRepository = userTokenRepository;
        _affiliateApplicationRepository = affiliateApplicationRepository;
        _companyVerificationRequestRepository = companyVerificationRequestRepository;
        _companyRepository = companyRepository;
        _emailOutboxRepository = emailOutboxRepository;
        _auditLogService = auditLogService;
        _emailNormalizer = emailNormalizer;
        _otpService = otpService;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _candidateRepository = candidateRepository;
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

        var primaryEmailIdentity = await _userEmailIdentityRepository.GetPrimaryByUserIdAsync(
            user.UserId, cancellationToken)
            ?? throw new ConflictException("Không tìm thấy danh tính email chính của tài khoản.");

        primaryEmailIdentity.Status = "VERIFIED";
        primaryEmailIdentity.VerifiedAt = now;
        primaryEmailIdentity.UpdatedAt = now;
        primaryEmailIdentity.ConcurrencyToken = Guid.NewGuid();
        _userEmailIdentityRepository.Update(primaryEmailIdentity);

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

            await QueueUnderReviewEmailAsync(
                user,
                "AFFILIATE_REGISTRATION_UNDER_REVIEW",
                "Đối tác tuyển dụng",
                now,
                cancellationToken);
            await AddEmailVerifiedAuditAsync(user.UserId, now, "AFFILIATE", cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Xác thực email thành công cho Affiliate UserId {UserId}. Hồ sơ chuyển sang UNDER_REVIEW chờ Admin duyệt.",
                user.UserId);

            return new VerifyEmailOtpResponse
            {
                Success = true,
                Message = "Xác thực email thành công. Hồ sơ Đối tác tuyển dụng đang chờ Ban quản trị phê duyệt.",
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
            await QueueUnderReviewEmailAsync(
                user,
                "CLIENT_REGISTRATION_UNDER_REVIEW",
                "Doanh nghiệp tuyển dụng",
                now,
                cancellationToken);
            await AddEmailVerifiedAuditAsync(user.UserId, now, "CLIENT", cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Xác thực email thành công cho Client UserId {UserId}, Company {CompanyId}. Chờ Admin duyệt.",
                user.UserId, companyVerification.CompanyId);

            return new VerifyEmailOtpResponse
            {
                Success = true,
                Message = "Xác thực email thành công. Hồ sơ Doanh nghiệp đang chờ Ban quản trị phê duyệt.",
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
        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var candidate = await CandidateRegistrationIdentity.ResolveAsync(
                _candidateRepository, normalizedEmail, user.NormalizedPhone, cancellationToken, user.UserId);
            if (candidate == null)
                throw new ConflictException("Không tìm thấy hồ sơ ứng viên khớp với email đã xác minh.");

            if (candidate.UserId == null && !await _candidateRepository.TryLinkByVerifiedEmailAsync(
                    candidate.CandidateId, normalizedEmail, user.UserId, cancellationToken))
                throw new ConflictException("Hồ sơ ứng viên đã thay đổi hoặc đã được liên kết với một tài khoản khác.");

            user.Status = "ACTIVE";
            _userRepository.Update(user);
            await AddEmailVerifiedAuditAsync(user.UserId, now, "CANDIDATE", cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(CancellationToken.None);
            throw;
        }

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

    private async Task QueueUnderReviewEmailAsync(
        AppUser user,
        string templateCode,
        string accountLabel,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var email = HRConnect.Application.Common.Email.HrConnectEmailTemplates
            .RegistrationUnderReview(accountLabel);
        await _emailOutboxRepository.AddAsync(new EmailOutbox
        {
            EmailOutboxId = Guid.NewGuid(),
            UserId = user.UserId,
            RecipientEmail = user.Email,
            TemplateCode = templateCode,
            Subject = email.Subject,
            Payload = JsonSerializer.Serialize(new { accountLabel }),
            Status = "PENDING",
            RetryCount = 0,
            NextRetryAt = now,
            CreatedAt = now
        }, cancellationToken);
    }

    private Task AddEmailVerifiedAuditAsync(
        Guid userId,
        DateTime verifiedAt,
        string accountType,
        CancellationToken cancellationToken) =>
        _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.EmailVerified,
            EntityType = "APP_USER",
            EntityId = userId,
            ActorUserId = userId,
            OldValues = new { emailVerifiedAt = (DateTime?)null },
            NewValues = new { emailVerifiedAt = verifiedAt, accountType },
            Source = AuditSources.Application
        }, cancellationToken);
}
