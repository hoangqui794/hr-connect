using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HRConnect.Application.Common.Email;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Candidates.Identity.ResendCandidateIdentityClaimOtp;

public sealed class ResendCandidateIdentityClaimOtpCommandHandler
    : IRequestHandler<ResendCandidateIdentityClaimOtpCommand, ResendCandidateIdentityClaimOtpResponse>
{
    private const int ResendCooldownSeconds = 60;
    private const int MaxResends = 5;
    private readonly IUserRepository _users;
    private readonly ICandidateRepository _candidates;
    private readonly ICandidateIdentityClaimRepository _claims;
    private readonly IEmailOutboxRepository _outboxes;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOtpService _otp;
    private readonly IEmailService _email;
    private readonly AuthenticationSettings _settings;
    private readonly ILogger<ResendCandidateIdentityClaimOtpCommandHandler> _logger;

    public ResendCandidateIdentityClaimOtpCommandHandler(
        IUserRepository users,
        ICandidateRepository candidates,
        ICandidateIdentityClaimRepository claims,
        IEmailOutboxRepository outboxes,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        IOtpService otp,
        IEmailService email,
        IOptions<AuthenticationSettings> settings,
        ILogger<ResendCandidateIdentityClaimOtpCommandHandler> logger)
    {
        _users = users;
        _candidates = candidates;
        _claims = claims;
        _outboxes = outboxes;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _otp = otp;
        _email = email;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<ResendCandidateIdentityClaimOtpResponse> Handle(
        ResendCandidateIdentityClaimOtpCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _users.GetByIdWithRolesAndPermissionsAsync(request.UserId, cancellationToken)
            ?? throw new ForbiddenException("Tài khoản không còn quyền quản lý danh tính Candidate.");
        EnsureEligibleCandidateAccount(user);

        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate của tài khoản hiện tại.");
        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
        {
            throw new ConflictException(
                "Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất.",
                "CANDIDATE_PROFILE_NOT_ELIGIBLE");
        }

        var claim = await _claims.GetByIdAsync(request.ClaimId, cancellationToken);
        if (claim == null || claim.RequesterUserId != request.UserId)
            throw new NotFoundException("Không tìm thấy yêu cầu xác minh email.");
        if (!string.Equals(claim.Status, "PENDING_VERIFICATION", StringComparison.Ordinal))
            throw new ConflictException(
                "Yêu cầu không còn ở trạng thái chờ xác minh.",
                "IDENTITY_CLAIM_NOT_PENDING");
        if (claim.ConcurrencyToken != request.ConcurrencyToken)
            throw new ConflictException(
                "Yêu cầu đã được cập nhật. Vui lòng tải lại trạng thái mới.",
                "STALE_IDENTITY_CLAIM");

        var now = DateTime.UtcNow;
        if (claim.ExpiresAt <= now)
            throw new ConflictException(
                "Yêu cầu đã hết hạn. Vui lòng tạo yêu cầu xác minh mới.",
                "IDENTITY_CLAIM_EXPIRED");
        if (claim.ResendCount >= MaxResends)
            throw new ConflictException(
                $"Đã đạt giới hạn {MaxResends} lần gửi lại OTP cho yêu cầu này.",
                "IDENTITY_CLAIM_RESEND_LIMIT_REACHED");

        var resendAfter = claim.LastSentAt?.AddSeconds(ResendCooldownSeconds);
        if (resendAfter > now)
            throw new ConflictException(
                $"Vui lòng chờ đến {resendAfter.Value:O} trước khi gửi lại OTP.",
                "IDENTITY_CLAIM_RESEND_COOLDOWN");

        var expirationMinutes = _settings.Otp?.ExpirationMinutes > 0
            ? _settings.Otp.ExpirationMinutes
            : 15;
        var otpLength = _settings.Otp?.Length > 0 ? _settings.Otp.Length : 6;
        var rawOtp = _otp.GenerateNumericOtp(otpLength);
        var newConcurrencyToken = Guid.NewGuid();
        var expiresAt = now.AddMinutes(expirationMinutes);
        var newResendCount = claim.ResendCount + 1;
        var outbox = new EmailOutbox
        {
            EmailOutboxId = Guid.NewGuid(),
            UserId = request.UserId,
            RecipientEmail = claim.AssertedEmail,
            TemplateCode = "CANDIDATE_IDENTITY_CLAIM_OTP_RESEND",
            Subject = "Mã xác minh email mới từ HR Connect",
            Payload = JsonSerializer.Serialize(new { claimId = claim.ClaimId, expiresAt }),
            Status = "PENDING",
            RetryCount = 0,
            CreatedAt = now
        };

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var rotated = await _claims.TryRotateOtpAsync(
                claim.ClaimId,
                request.UserId,
                request.ConcurrencyToken,
                newConcurrencyToken,
                _otp.HashOtp(rawOtp),
                now,
                expiresAt,
                now.AddSeconds(-ResendCooldownSeconds),
                MaxResends,
                cancellationToken);
            if (!rotated)
            {
                throw new ConflictException(
                    "Yêu cầu đã được xử lý ở thiết bị khác. Vui lòng tải lại trạng thái mới.",
                    "IDENTITY_CLAIM_CONCURRENT_UPDATE");
            }

            await _outboxes.AddAsync(outbox, cancellationToken);
            await _audit.AddAsync(new AuditEntry
            {
                Action = AuditActions.IdentityClaimOtpResent,
                EntityType = "CANDIDATE_IDENTITY_CLAIM",
                EntityId = claim.ClaimId,
                ActorUserId = request.UserId,
                ActorType = "USER",
                Source = "API",
                ServiceName = "HRConnect.Presentation",
                NewValues = new
                {
                    status = "PENDING_VERIFICATION",
                    resendCount = newResendCount,
                    emailMasked = MaskEmail(claim.NormalizedEmail),
                    emailHash = HashForAudit(claim.NormalizedEmail),
                    expiresAt
                }
            }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        var recipientName = string.IsNullOrWhiteSpace(user.DisplayName) ? "bạn" : user.DisplayName.Trim();
        var email = HrConnectEmailTemplates.CandidateIdentityClaimOtp(
            recipientName, rawOtp, expirationMinutes);
        outbox.Subject = email.Subject;
        var deliveryStatus = "FAILED";
        try
        {
            var result = await _email.SendEmailAsync(
                claim.AssertedEmail, email.Subject, email.HtmlBody, CancellationToken.None);
            deliveryStatus = result.IsSuccess ? "SENT" : "FAILED";
            outbox.Status = deliveryStatus;
            outbox.SentAt = result.IsSuccess ? DateTime.UtcNow : null;
            outbox.RetryCount = result.IsSuccess ? 0 : 1;
            outbox.LastError = result.IsSuccess ? null : result.ErrorMessage;
            outbox.NextRetryAt = null;
            await _unitOfWork.SaveChangesAsync(CancellationToken.None);
            if (!result.IsSuccess)
                _logger.LogWarning("Không gửi được OTP mới cho claim danh tính {ClaimId}.", claim.ClaimId);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "Lỗi khi gửi OTP mới cho claim danh tính {ClaimId}.", claim.ClaimId);
            outbox.Status = "FAILED";
            outbox.RetryCount = 1;
            outbox.LastError = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
            outbox.NextRetryAt = null;
            try
            {
                await _unitOfWork.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception persistenceException)
            {
                _logger.LogError(persistenceException,
                    "Không cập nhật được trạng thái email outbox {OutboxId}.", outbox.EmailOutboxId);
            }
        }

        return new ResendCandidateIdentityClaimOtpResponse(
            true,
            deliveryStatus == "SENT"
                ? "HR Connect đã gửi mã OTP mới đến email của bạn."
                : "Yêu cầu gửi lại đã được ghi nhận nhưng nhà cung cấp email đang gặp lỗi. Vui lòng thử lại sau.",
            claim.ClaimId,
            MaskEmail(claim.NormalizedEmail),
            expiresAt,
            now.AddSeconds(ResendCooldownSeconds),
            newResendCount,
            deliveryStatus,
            newConcurrencyToken);
    }

    private static void EnsureEligibleCandidateAccount(AppUser user)
    {
        var hasPermission = user.UserRoleUsers.Any(assignment =>
            string.Equals(assignment.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
            assignment.Role.IsActive &&
            string.Equals(assignment.Role.Code, "CANDIDATE", StringComparison.OrdinalIgnoreCase) &&
            assignment.Role.RolePermissions.Any(rolePermission =>
                rolePermission.Permission.IsActive &&
                rolePermission.Permission.Code == "candidate.identity.manage_own"));
        if (!string.Equals(user.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) || !hasPermission)
            throw new ForbiddenException(
                "Tài khoản không còn hoạt động hoặc đã bị thu hồi quyền quản lý danh tính Candidate.");
    }

    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return "***";
        var local = email[..at];
        return $"{local[..Math.Min(2, local.Length)]}***{email[at..]}";
    }

    private static string HashForAudit(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
