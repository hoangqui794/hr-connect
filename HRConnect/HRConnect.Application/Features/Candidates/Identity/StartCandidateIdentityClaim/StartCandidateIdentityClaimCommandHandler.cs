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

namespace HRConnect.Application.Features.Candidates.Identity.StartCandidateIdentityClaim;

public sealed class StartCandidateIdentityClaimCommandHandler
    : IRequestHandler<StartCandidateIdentityClaimCommand, StartCandidateIdentityClaimResponse>
{
    private const int ResendCooldownSeconds = 60;
    private readonly IUserRepository _users;
    private readonly ICandidateRepository _candidates;
    private readonly IUserEmailIdentityRepository _emailIdentities;
    private readonly ICandidateIdentityClaimRepository _claims;
    private readonly IEmailOutboxRepository _outboxes;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IOtpService _otpService;
    private readonly IEmailService _emailService;
    private readonly AuthenticationSettings _settings;
    private readonly ILogger<StartCandidateIdentityClaimCommandHandler> _logger;

    public StartCandidateIdentityClaimCommandHandler(
        IUserRepository users,
        ICandidateRepository candidates,
        IUserEmailIdentityRepository emailIdentities,
        ICandidateIdentityClaimRepository claims,
        IEmailOutboxRepository outboxes,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        IEmailNormalizer emailNormalizer,
        IOtpService otpService,
        IEmailService emailService,
        IOptions<AuthenticationSettings> options,
        ILogger<StartCandidateIdentityClaimCommandHandler> logger)
    {
        _users = users;
        _candidates = candidates;
        _emailIdentities = emailIdentities;
        _claims = claims;
        _outboxes = outboxes;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _emailNormalizer = emailNormalizer;
        _otpService = otpService;
        _emailService = emailService;
        _settings = options.Value;
        _logger = logger;
    }

    public async Task<StartCandidateIdentityClaimResponse> Handle(
        StartCandidateIdentityClaimCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _users.GetByIdWithRolesAndPermissionsAsync(request.UserId, cancellationToken)
            ?? throw new ForbiddenException("Tài khoản không còn quyền quản lý danh tính Candidate.");
        EnsureEligibleCandidateAccount(user);

        var requesterCandidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate của tài khoản hiện tại.");
        if (!string.Equals(requesterCandidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            requesterCandidate.MergedIntoCandidateId.HasValue)
        {
            throw new ConflictException(
                "Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất.",
                "CANDIDATE_PROFILE_NOT_ELIGIBLE");
        }

        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
            throw new BadRequestException("Email không đúng định dạng.");

        var currentIdentity = await _emailIdentities.GetActiveByNormalizedEmailAsync(
            normalizedEmail, cancellationToken);
        if (currentIdentity?.UserId == request.UserId)
        {
            throw new ConflictException(
                "Email này đã được liên kết với tài khoản của bạn.",
                "EMAIL_IDENTITY_ALREADY_LINKED");
        }

        var now = DateTime.UtcNow;
        var existingClaim = await _claims.GetActiveByRequesterAndEmailAsync(
            request.UserId, normalizedEmail, cancellationToken);
        if (existingClaim != null &&
            (existingClaim.Status != "PENDING_VERIFICATION" || existingClaim.ExpiresAt > now))
            return CreateResponse(existingClaim);

        if (existingClaim != null)
        {
            existingClaim.Status = "EXPIRED";
            existingClaim.CompletedAt = now;
            existingClaim.UpdatedAt = now;
            existingClaim.ConcurrencyToken = Guid.NewGuid();
            _claims.Update(existingClaim);
        }

        var expirationMinutes = _settings.Otp?.ExpirationMinutes > 0
            ? _settings.Otp.ExpirationMinutes
            : 15;
        var otpLength = _settings.Otp?.Length > 0 ? _settings.Otp.Length : 6;
        var rawOtp = _otpService.GenerateNumericOtp(otpLength);
        var foreignPrimaryUser = await _users.GetByEmailAsync(normalizedEmail, cancellationToken);
        var suppressDelivery = currentIdentity != null ||
                               foreignPrimaryUser is { UserId: var ownerId } && ownerId != request.UserId;
        var targetCandidate = suppressDelivery
            ? null
            : await _candidates.GetByNormalizedEmailAsync(normalizedEmail, cancellationToken);

        var claim = new CandidateIdentityClaim
        {
            ClaimId = Guid.NewGuid(),
            RequesterUserId = request.UserId,
            RequesterCandidateId = requesterCandidate.CandidateId,
            TargetCandidateId = targetCandidate?.CandidateId,
            AssertedEmail = request.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            TokenHash = _otpService.HashOtp(rawOtp),
            Status = suppressDelivery ? "CANCELLED" : "PENDING_VERIFICATION",
            ExpiresAt = now.AddMinutes(expirationMinutes),
            AttemptCount = 0,
            ResendCount = 0,
            LastSentAt = suppressDelivery ? null : now,
            CompletedAt = suppressDelivery ? now : null,
            ReviewReason = suppressDelivery ? "EMAIL_OWNED_BY_ANOTHER_ACCOUNT" : null,
            CreatedAt = now,
            UpdatedAt = now,
            ConcurrencyToken = Guid.NewGuid()
        };

        EmailOutbox? outbox = null;
        if (!suppressDelivery)
        {
            outbox = new EmailOutbox
            {
                EmailOutboxId = Guid.NewGuid(),
                UserId = request.UserId,
                RecipientEmail = request.Email.Trim(),
                TemplateCode = "CANDIDATE_IDENTITY_CLAIM_OTP",
                Subject = "Xác minh email liên kết hồ sơ HR Connect",
                Payload = JsonSerializer.Serialize(new
                {
                    claimId = claim.ClaimId,
                    expiresAt = claim.ExpiresAt
                }),
                Status = "PENDING",
                RetryCount = 0,
                CreatedAt = now
            };
        }

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            await _claims.AddAsync(claim, cancellationToken);
            if (outbox != null) await _outboxes.AddAsync(outbox, cancellationToken);
            await _audit.AddAsync(new AuditEntry
            {
                Action = AuditActions.IdentityClaimRequested,
                EntityType = "CANDIDATE_IDENTITY_CLAIM",
                EntityId = claim.ClaimId,
                ActorUserId = request.UserId,
                ActorType = "USER",
                Source = "API",
                ServiceName = "HRConnect.Presentation",
                NewValues = new
                {
                    status = claim.Status,
                    targetCandidateId = claim.TargetCandidateId,
                    emailMasked = MaskEmail(normalizedEmail),
                    emailHash = HashForAudit(normalizedEmail),
                    expiresAt = claim.ExpiresAt
                }
            }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            var concurrentWinner = await _claims.GetActiveByRequesterAndEmailAsync(
                request.UserId, normalizedEmail, cancellationToken);
            if (concurrentWinner != null &&
                (existingClaim == null || concurrentWinner.ClaimId != existingClaim.ClaimId))
            {
                return CreateResponse(concurrentWinner);
            }
            throw;
        }

        if (outbox != null)
        {
            var recipientName = string.IsNullOrWhiteSpace(user.DisplayName)
                ? "bạn"
                : user.DisplayName.Trim();
            var email = HrConnectEmailTemplates.CandidateIdentityClaimOtp(
                recipientName, rawOtp, expirationMinutes);
            try
            {
                var result = await _emailService.SendEmailAsync(
                    claim.AssertedEmail, email.Subject, email.HtmlBody, cancellationToken);
                outbox.Status = result.IsSuccess ? "SENT" : "FAILED";
                outbox.SentAt = result.IsSuccess ? DateTime.UtcNow : null;
                outbox.RetryCount = result.IsSuccess ? 0 : 1;
                outbox.LastError = result.IsSuccess ? null : result.ErrorMessage;
                outbox.NextRetryAt = null;
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                if (!result.IsSuccess)
                {
                    _logger.LogWarning(
                        "Không gửi được OTP claim danh tính {ClaimId}; Candidate có thể dùng API gửi lại.",
                        claim.ClaimId);
                }
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogError(ex,
                    "Lỗi khi gửi OTP claim danh tính {ClaimId}; yêu cầu vẫn có thể gửi lại.",
                    claim.ClaimId);
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
                        "Không cập nhật được trạng thái email outbox {OutboxId}.",
                        outbox.EmailOutboxId);
                }
            }
        }

        return CreateResponse(claim);
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
        {
            throw new ForbiddenException(
                "Tài khoản không còn hoạt động hoặc đã bị thu hồi quyền quản lý danh tính Candidate.");
        }
    }

    private static StartCandidateIdentityClaimResponse CreateResponse(CandidateIdentityClaim claim)
    {
        var resendAfter = claim.LastSentAt?.AddSeconds(ResendCooldownSeconds)
                          ?? DateTime.UtcNow.AddSeconds(ResendCooldownSeconds);
        return new StartCandidateIdentityClaimResponse(
            true,
            "Nếu email hợp lệ, HR Connect đã gửi mã xác minh. Vui lòng kiểm tra hộp thư.",
            new StartCandidateIdentityClaimData(
                claim.ClaimId,
                MaskEmail(claim.NormalizedEmail),
                claim.ExpiresAt,
                resendAfter,
                claim.ConcurrencyToken));
    }

    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return "***";
        var local = email[..at];
        var visible = local.Length <= 2 ? local[..1] : local[..2];
        return $"{visible}***{email[at..]}";
    }

    private static string HashForAudit(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
