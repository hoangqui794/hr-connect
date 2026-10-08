using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Admin.IdentityClaims.RejectIdentityClaim;

public sealed class RejectIdentityClaimCommandHandler(
    ICandidateIdentityClaimRepository claims,
    IUserRepository users,
    INotificationRepository notifications,
    IAuditLogService audit,
    IUnitOfWork unitOfWork)
    : IRequestHandler<RejectIdentityClaimCommand, RejectIdentityClaimResponse>
{
    private const string ReviewPermission = "candidate.identity.review";

    public async Task<RejectIdentityClaimResponse> Handle(
        RejectIdentityClaimCommand request,
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

            var now = DateTime.UtcNow;
            var finalToken = Guid.NewGuid();
            var reason = request.Reason.Trim();
            if (!await claims.TryAdminResolveAsync(
                    claim.ClaimId,
                    request.ConcurrencyToken,
                    finalToken,
                    request.AdminUserId,
                    "REJECTED",
                    now,
                    reason,
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
                Title = "Yêu cầu liên kết hồ sơ chưa được chấp thuận",
                Message = $"HR Connect chưa thể liên kết hồ sơ Candidate trước đây. Lý do: {reason}",
                RelatedEntityType = "CANDIDATE_IDENTITY_CLAIM",
                RelatedEntityId = claim.ClaimId,
                Metadata = JsonSerializer.Serialize(new
                {
                    claimId = claim.ClaimId,
                    status = "REJECTED",
                    reason
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
                NewValues = new { status = "REJECTED", reason }
            }, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);
            await unitOfWork.CommitTransactionAsync(cancellationToken);

            return new RejectIdentityClaimResponse(
                true,
                "Yêu cầu liên kết danh tính Candidate đã bị từ chối.",
                claim.ClaimId,
                "REJECTED",
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
}
