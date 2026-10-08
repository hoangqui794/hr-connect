using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Admin.IdentityClaims.ApproveIdentityClaim;

public sealed class ApproveIdentityClaimCommandHandler(
    ICandidateIdentityClaimRepository claims,
    ICandidateRepository candidates,
    IUserEmailIdentityRepository identities,
    IUserRepository users,
    INotificationRepository notifications,
    IAuditLogService audit,
    IUnitOfWork unitOfWork)
    : IRequestHandler<ApproveIdentityClaimCommand, ApproveIdentityClaimResponse>
{
    private const string ReviewPermission = "candidate.identity.review";

    public async Task<ApproveIdentityClaimResponse> Handle(
        ApproveIdentityClaimCommand request,
        CancellationToken cancellationToken)
    {
        await unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var claim = await claims.GetByIdAsync(request.ClaimId, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy yêu cầu liên kết danh tính Candidate.");

            if (!string.Equals(claim.Status, "PENDING_ADMIN_REVIEW", StringComparison.Ordinal))
            {
                throw new ConflictException(
                    "Yêu cầu không còn ở trạng thái chờ Ban quản trị xem xét.",
                    "IDENTITY_CLAIM_NOT_PENDING_REVIEW");
            }

            if (claim.ConcurrencyToken != request.ConcurrencyToken)
            {
                throw new ConflictException(
                    "Yêu cầu đã được cập nhật. Vui lòng tải lại chi tiết mới nhất.",
                    "STALE_IDENTITY_CLAIM");
            }

            var admin = await users.GetByIdWithRolesAndPermissionsAsync(
                request.AdminUserId, cancellationToken)
                ?? throw new ForbiddenException("Tài khoản quản trị không còn quyền xử lý yêu cầu này.");
            EnsureEligibleReviewer(admin);

            var requesterUser = await users.GetByIdAsync(claim.RequesterUserId, cancellationToken);
            if (requesterUser == null ||
                !string.Equals(requesterUser.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            {
                throw new ConflictException(
                    "Tài khoản Candidate không còn hoạt động. Không thể phê duyệt yêu cầu.",
                    "IDENTITY_CLAIM_REQUESTER_INACTIVE");
            }

            var requesterCandidate = await candidates.GetByIdAsync(
                claim.RequesterCandidateId, cancellationToken);
            if (requesterCandidate == null ||
                requesterCandidate.UserId != claim.RequesterUserId ||
                !string.Equals(requesterCandidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
                requesterCandidate.MergedIntoCandidateId.HasValue)
            {
                throw new ConflictException(
                    "Hồ sơ Candidate hiện tại đã thay đổi và không còn đủ điều kiện liên kết.",
                    "IDENTITY_CLAIM_REQUESTER_PROFILE_CHANGED");
            }

            var emailOwner = await identities.GetActiveByNormalizedEmailAsync(
                claim.NormalizedEmail, cancellationToken);
            if (emailOwner == null || emailOwner.UserId != claim.RequesterUserId ||
                !string.Equals(emailOwner.Status, "VERIFIED", StringComparison.OrdinalIgnoreCase))
            {
                throw new ConflictException(
                    "Email cần liên kết không còn được xác minh cho đúng tài khoản Candidate.",
                    "IDENTITY_CLAIM_EMAIL_OWNERSHIP_CHANGED");
            }

            var canonicalCandidateId = claim.RequesterCandidateId;
            if (claim.TargetCandidateId.HasValue &&
                claim.TargetCandidateId.Value != claim.RequesterCandidateId)
            {
                var target = await candidates.GetByIdAsync(
                    claim.TargetCandidateId.Value, cancellationToken);
                if (target == null || target.UserId.HasValue ||
                    !string.Equals(target.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
                    target.MergedIntoCandidateId.HasValue ||
                    !string.Equals(target.NormalizedEmail, claim.NormalizedEmail, StringComparison.Ordinal))
                {
                    throw ManualMergeRequired(
                        "Hồ sơ cũ đã thay đổi hoặc không còn đủ điều kiện để liên kết tự động.");
                }

                if (await candidates.HasIdentityBusinessDataAsync(
                        claim.RequesterCandidateId, cancellationToken))
                {
                    throw ManualMergeRequired(
                        "Cả hai hồ sơ Candidate đều đã có dữ liệu nghiệp vụ. Hệ thống không tự động gộp để tránh mất hoặc trùng dữ liệu.");
                }

                if (!await candidates.TrySwapIdentityCandidateAsync(
                        claim.RequesterCandidateId,
                        target.CandidateId,
                        claim.RequesterUserId,
                        claim.NormalizedEmail,
                        cancellationToken))
                {
                    throw new ConflictException(
                        "Dữ liệu Candidate vừa thay đổi trong lúc xử lý. Vui lòng tải lại và kiểm tra trước khi phê duyệt.",
                        "IDENTITY_CLAIM_CONCURRENT_CANDIDATE_CHANGE");
                }

                canonicalCandidateId = target.CandidateId;
            }

            var now = DateTime.UtcNow;
            var finalToken = Guid.NewGuid();
            var reviewNote = string.IsNullOrWhiteSpace(request.Note)
                ? "ADMIN_APPROVED_SAFE_LINK"
                : request.Note.Trim();
            if (!await claims.TryAdminResolveAsync(
                    claim.ClaimId,
                    request.ConcurrencyToken,
                    finalToken,
                    request.AdminUserId,
                    "COMPLETED",
                    now,
                    reviewNote,
                    cancellationToken))
            {
                throw new ConflictException(
                    "Yêu cầu đã được Admin khác xử lý. Vui lòng tải lại trạng thái mới nhất.",
                    "IDENTITY_CLAIM_CONCURRENT_REVIEW");
            }

            await notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = claim.RequesterUserId,
                NotificationType = "CANDIDATE_IDENTITY",
                Title = "Hồ sơ Candidate đã được liên kết",
                Message = "HR Connect đã phê duyệt yêu cầu và liên kết dữ liệu hồ sơ trước đây với tài khoản của bạn.",
                RelatedEntityType = "CANDIDATE_IDENTITY_CLAIM",
                RelatedEntityId = claim.ClaimId,
                Metadata = JsonSerializer.Serialize(new
                {
                    claimId = claim.ClaimId,
                    status = "COMPLETED",
                    candidateId = canonicalCandidateId
                }),
                IsRead = false,
                CreatedAt = now
            }, cancellationToken);

            await audit.AddAsync(new AuditEntry
            {
                Action = AuditActions.IdentityClaimReviewed,
                EntityType = "CANDIDATE_IDENTITY_CLAIM",
                EntityId = claim.ClaimId,
                ActorUserId = request.AdminUserId,
                ActorType = "ADMIN",
                Source = "API",
                ServiceName = "HRConnect.Presentation",
                OldValues = new
                {
                    status = "PENDING_ADMIN_REVIEW",
                    reason = claim.ReviewReason,
                    requesterCandidateId = claim.RequesterCandidateId,
                    targetCandidateId = claim.TargetCandidateId
                },
                NewValues = new
                {
                    status = "COMPLETED",
                    candidateId = canonicalCandidateId,
                    reviewNote
                }
            }, cancellationToken);

            if (canonicalCandidateId != claim.RequesterCandidateId)
            {
                await audit.AddAsync(new AuditEntry
                {
                    Action = AuditActions.CandidateIdentityClaimed,
                    EntityType = "CANDIDATE",
                    EntityId = canonicalCandidateId,
                    ActorUserId = request.AdminUserId,
                    ActorType = "ADMIN",
                    Source = "API",
                    ServiceName = "HRConnect.Presentation",
                    OldValues = new { candidateId = claim.RequesterCandidateId },
                    NewValues = new { candidateId = canonicalCandidateId, claimId = claim.ClaimId }
                }, cancellationToken);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
            await unitOfWork.CommitTransactionAsync(cancellationToken);

            return new ApproveIdentityClaimResponse(
                true,
                "Yêu cầu liên kết danh tính Candidate đã được phê duyệt.",
                claim.ClaimId,
                "COMPLETED",
                canonicalCandidateId,
                finalToken);
        }
        catch
        {
            await unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }
    }

    private static void EnsureEligibleReviewer(AppUser user)
    {
        var hasPermission = user.UserRoleUsers.Any(assignment =>
            string.Equals(assignment.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
            assignment.Role.IsActive &&
            (string.Equals(assignment.Role.Code, "PLATFORM_ADMIN", StringComparison.OrdinalIgnoreCase) ||
             assignment.Role.RolePermissions.Any(rolePermission =>
                 rolePermission.Permission.IsActive &&
                 string.Equals(rolePermission.Permission.Code, ReviewPermission, StringComparison.Ordinal))));

        if (!string.Equals(user.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) || !hasPermission)
        {
            throw new ForbiddenException("Tài khoản quản trị không còn hoạt động hoặc đã bị thu hồi quyền xử lý yêu cầu.");
        }
    }

    private static ConflictException ManualMergeRequired(string message) =>
        new(message, "IDENTITY_CLAIM_MANUAL_MERGE_REQUIRED");
}
