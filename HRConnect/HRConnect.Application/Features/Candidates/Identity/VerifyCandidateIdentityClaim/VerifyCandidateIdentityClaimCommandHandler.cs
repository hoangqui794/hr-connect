using System.Security.Cryptography;
using System.Text;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.VerifyCandidateIdentityClaim;

public sealed class VerifyCandidateIdentityClaimCommandHandler
    : IRequestHandler<VerifyCandidateIdentityClaimCommand, VerifyCandidateIdentityClaimResponse>
{
    private readonly ICandidateIdentityClaimRepository _claims;
    private readonly ICandidateRepository _candidates;
    private readonly IUserEmailIdentityRepository _identities;
    private readonly ICandidateDuplicateRepository _duplicateCases;
    private readonly IOtpService _otp;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppNotifier? _notifier;

    public VerifyCandidateIdentityClaimCommandHandler(
        ICandidateIdentityClaimRepository claims,
        ICandidateRepository candidates,
        IUserEmailIdentityRepository identities,
        ICandidateDuplicateRepository duplicateCases,
        IOtpService otp,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        IAppNotifier? notifier = null)
    {
        _claims = claims;
        _candidates = candidates;
        _identities = identities;
        _duplicateCases = duplicateCases;
        _otp = otp;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _notifier = notifier;
    }

    public async Task<VerifyCandidateIdentityClaimResponse> Handle(
        VerifyCandidateIdentityClaimCommand request,
        CancellationToken cancellationToken)
    {
        var claim = await _claims.GetByIdAsync(request.ClaimId, cancellationToken);
        if (claim == null || claim.RequesterUserId != request.UserId ||
            claim.Status != "PENDING_VERIFICATION")
        {
            throw new BadRequestException("Yêu cầu xác minh không hợp lệ hoặc không còn hiệu lực.");
        }
        if (claim.ConcurrencyToken != request.ConcurrencyToken)
            throw new ConflictException("Yêu cầu đã được cập nhật. Vui lòng tải lại trạng thái mới.", "STALE_IDENTITY_CLAIM");

        var now = DateTime.UtcNow;
        if (claim.ExpiresAt <= now)
        {
            claim.Status = "EXPIRED";
            claim.CompletedAt = now;
            claim.UpdatedAt = now;
            claim.ConcurrencyToken = Guid.NewGuid();
            _claims.Update(claim);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            throw new BadRequestException("Mã OTP đã hết hạn. Vui lòng tạo yêu cầu mới.");
        }

        if (!_otp.VerifyOtp(request.Otp, claim.TokenHash))
        {
            var close = claim.AttemptCount + 1 >= 5;
            var updated = await _claims.TryRecordFailedAttemptAsync(
                claim.ClaimId, request.UserId, request.ConcurrencyToken, Guid.NewGuid(), close, now, cancellationToken);
            if (!updated)
                throw new ConflictException("Yêu cầu đã được xử lý ở thiết bị khác.", "IDENTITY_CLAIM_CONCURRENT_UPDATE");
            throw new BadRequestException(close
                ? "Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng tạo yêu cầu mới."
                : "Mã OTP không chính xác.");
        }

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var verifiedToken = Guid.NewGuid();
            if (!await _claims.TryMarkVerifiedAsync(
                    claim.ClaimId, request.UserId, request.ConcurrencyToken, verifiedToken, now, cancellationToken))
            {
                throw new ConflictException("Yêu cầu đã được xử lý ở thiết bị khác.", "IDENTITY_CLAIM_CONCURRENT_UPDATE");
            }

            var existingIdentity = await _identities.GetActiveByNormalizedEmailAsync(
                claim.NormalizedEmail, cancellationToken);
            var requiresReview = existingIdentity != null && existingIdentity.UserId != request.UserId;

            if (existingIdentity == null)
            {
                await _identities.AddAsync(new UserEmailIdentity
                {
                    EmailIdentityId = Guid.NewGuid(),
                    UserId = request.UserId,
                    Email = claim.AssertedEmail,
                    NormalizedEmail = claim.NormalizedEmail,
                    Kind = "ALIAS",
                    Status = "VERIFIED",
                    VerificationSource = "CANDIDATE_IDENTITY_CLAIM",
                    VerifiedAt = now,
                    CreatedAt = now,
                    UpdatedAt = now,
                    ConcurrencyToken = Guid.NewGuid()
                }, cancellationToken);
            }

            Guid? canonicalCandidateId = claim.RequesterCandidateId;
            Guid? duplicateCaseId = null;
            string? reviewReason = null;
            if (!requiresReview && claim.TargetCandidateId.HasValue &&
                claim.TargetCandidateId.Value != claim.RequesterCandidateId)
            {
                var target = await _candidates.GetByIdAsync(claim.TargetCandidateId.Value, cancellationToken);
                var placeholderHasData = await _candidates.HasIdentityBusinessDataAsync(
                    claim.RequesterCandidateId, cancellationToken);
                if (target == null || target.UserId.HasValue || target.Status != "ACTIVE" ||
                    target.MergedIntoCandidateId.HasValue || placeholderHasData)
                {
                    requiresReview = true;
                    reviewReason = "CANDIDATE_SWAP_REQUIRES_ADMIN_REVIEW";
                    if (target != null && target.Status == "ACTIVE" && !target.MergedIntoCandidateId.HasValue)
                    {
                        var duplicateCaseResult = await _duplicateCases.GetOrCreateVerifiedIdentityClaimCaseAsync(
                            claim.RequesterCandidateId,
                            target.CandidateId,
                            claim.ClaimId,
                            now,
                            cancellationToken);
                        duplicateCaseId = duplicateCaseResult.DuplicateCase.DuplicateCaseId;
                        if (duplicateCaseResult.Created && _notifier != null)
                        {
                            await _notifier.NotifyRoleAsync(
                                "PLATFORM_ADMIN",
                                new AppNotice(
                                    "SYSTEM",
                                    "Có hồ sơ danh tính nghi trùng cần xử lý",
                                    "Candidate vừa xác minh email nhưng dữ liệu có dấu hiệu thuộc hai hồ sơ khác nhau.",
                                    "CANDIDATE_DUPLICATE_CASE",
                                    duplicateCaseResult.DuplicateCase.DuplicateCaseId,
                                    "/admin/candidate-identity-claims"),
                                cancellationToken);
                        }
                    }
                }
                else if (!await _candidates.TrySwapIdentityCandidateAsync(
                             claim.RequesterCandidateId,
                             target.CandidateId,
                             request.UserId,
                             claim.NormalizedEmail,
                             cancellationToken))
                {
                    requiresReview = true;
                    reviewReason = "CANDIDATE_SWAP_CONCURRENT_CONFLICT";
                }
                else
                {
                    canonicalCandidateId = target.CandidateId;
                }
            }
            else if (requiresReview)
            {
                reviewReason = "EMAIL_IDENTITY_OWNERSHIP_CONFLICT";
            }

            var finalStatus = requiresReview ? "PENDING_ADMIN_REVIEW" : "COMPLETED";
            var finalToken = Guid.NewGuid();
            if (!await _claims.TryCompleteAsync(
                    claim.ClaimId, request.UserId, verifiedToken, finalStatus, finalToken, now,
                    reviewReason, cancellationToken))
            {
                throw new ConflictException("Yêu cầu đã được xử lý ở thiết bị khác.", "IDENTITY_CLAIM_CONCURRENT_UPDATE");
            }

            await _audit.AddAsync(new AuditEntry
            {
                Action = AuditActions.IdentityEmailVerified,
                EntityType = "CANDIDATE_IDENTITY_CLAIM",
                EntityId = claim.ClaimId,
                ActorUserId = request.UserId,
                NewValues = new
                {
                    status = finalStatus,
                    emailMasked = MaskEmail(claim.NormalizedEmail),
                    emailHash = HashForAudit(claim.NormalizedEmail),
                    candidateId = canonicalCandidateId
                }
            }, cancellationToken);
            if (finalStatus == "COMPLETED" && canonicalCandidateId != claim.RequesterCandidateId)
            {
                await _audit.AddAsync(new AuditEntry
                {
                    Action = AuditActions.CandidateIdentityClaimed,
                    EntityType = "CANDIDATE",
                    EntityId = canonicalCandidateId,
                    ActorUserId = request.UserId,
                    OldValues = new { candidateId = claim.RequesterCandidateId },
                    NewValues = new { candidateId = canonicalCandidateId, claimId = claim.ClaimId }
                }, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
            return new VerifyCandidateIdentityClaimResponse(
                true,
                requiresReview
                    ? "Email đã được xác minh. Yêu cầu liên kết hồ sơ đang chờ Ban quản trị xem xét."
                    : "Email và hồ sơ Candidate đã được liên kết thành công.",
                claim.ClaimId,
                finalStatus,
                canonicalCandidateId,
                finalToken,
                duplicateCaseId);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }
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
