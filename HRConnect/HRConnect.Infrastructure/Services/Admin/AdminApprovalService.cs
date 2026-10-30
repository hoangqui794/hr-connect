using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HRConnect.Infrastructure.Services.Admin;

public class AdminApprovalService : IAdminApprovalService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminApprovalService> _logger;

    public AdminApprovalService(
        ApplicationDbContext context,
        IAuditLogService auditLogService,
        ILogger<AdminApprovalService> logger)
    {
        _context = context;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task ApproveAffiliateApplicationAsync(
        Guid applicationId,
        Guid adminUserId,
        string? reviewNote = null,
        CancellationToken cancellationToken = default)
    {
        var application = await _context.AffiliateApplications
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.AffiliateApplicationId == applicationId, cancellationToken);

        if (application == null)
        {
            throw new NotFoundException("Không tìm thấy đơn đăng ký Affiliate.");
        }

        if (application.User.EmailVerifiedAt == null)
        {
            throw new ConflictException("Người dùng chưa xác thực email bằng OTP, không thể phê duyệt hồ sơ Affiliate.");
        }

        if (!string.Equals(application.Status, "UNDER_REVIEW", StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException($"Đơn đăng ký Affiliate đang ở trạng thái {application.Status}; chỉ hồ sơ UNDER_REVIEW mới được phê duyệt.");
        }

        if (!string.Equals(application.User.Status, "PENDING", StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException(
                "Tài khoản không còn ở trạng thái chờ phê duyệt. Vui lòng kiểm tra trạng thái mới nhất trước khi thao tác.",
                "ACCOUNT_NOT_PENDING_APPROVAL");
        }

        var affiliateRole = await _context.Roles
            .FirstOrDefaultAsync(
                role => role.Code == "AFFILIATE" && role.IsActive,
                cancellationToken);
        if (affiliateRole == null)
        {
            throw new ConflictException("Role AFFILIATE đang thiếu hoặc đã bị tắt; chưa thể phê duyệt hồ sơ.");
        }

        var now = DateTime.UtcNow;

        var saveAction = async () =>
        {
            // 1. Cập nhật trạng thái đơn đăng ký
            application.Status = "APPROVED";
            application.ReviewedBy = adminUserId;
            application.ReviewedAt = now;
            application.ReviewNote = reviewNote;

            // 2. Tạo hoặc kích hoạt AffiliateProfile
            var profile = await _context.AffiliateProfiles
                .FirstOrDefaultAsync(p => p.UserId == application.UserId, cancellationToken);

            if (profile == null)
            {
                profile = new AffiliateProfile
                {
                    AffiliateId = Guid.NewGuid(),
                    UserId = application.UserId,
                    AffiliateType = application.AffiliateType,
                    DisplayName = application.DisplayName,
                    Phone = application.Phone,
                    Status = "ACTIVE",
                    VerifiedAt = now,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await _context.AffiliateProfiles.AddAsync(profile, cancellationToken);
            }
            else
            {
                profile.Status = "ACTIVE";
                profile.VerifiedAt = now;
                profile.UpdatedAt = now;
                _context.AffiliateProfiles.Update(profile);
            }

            // 3. Gán Role AFFILIATE
            var existingUserRole = await _context.UserRoles
                .FirstOrDefaultAsync(ur => ur.UserId == application.UserId && ur.RoleId == affiliateRole.RoleId, cancellationToken);

            if (existingUserRole == null)
            {
                await _context.UserRoles.AddAsync(new UserRole
                {
                    UserId = application.UserId,
                    RoleId = affiliateRole.RoleId,
                    AssignmentSource = "AFFILIATE_APPROVAL",
                    AssignedBy = adminUserId,
                    AssignedAt = now,
                    Status = "ACTIVE"
                }, cancellationToken);
            }
            else
            {
                existingUserRole.Status = "ACTIVE";
                existingUserRole.AssignmentSource = "AFFILIATE_APPROVAL";
                existingUserRole.AssignedBy = adminUserId;
                existingUserRole.AssignedAt = now;
                existingUserRole.RevokedAt = null;
                existingUserRole.RevokedBy = null;
                existingUserRole.RevokeReason = null;
                _context.UserRoles.Update(existingUserRole);
            }

            // 4. Kích hoạt tài khoản AppUser
            application.User.Status = "ACTIVE";
            application.User.AuthorizationConcurrencyToken = Guid.NewGuid();
            application.User.UpdatedAt = now;
            _context.AppUsers.Update(application.User);

            await AddReviewAuditAsync(
                AuditActions.AffiliateApproved,
                "AFFILIATE_APPLICATION",
                application.AffiliateApplicationId,
                adminUserId,
                "UNDER_REVIEW",
                "APPROVED",
                cancellationToken);
            await QueueReviewEmailAsync(
                application.UserId,
                application.User.Email,
                "AFFILIATE_REGISTRATION_APPROVED",
                "Đối tác tuyển dụng",
                approved: true,
                reviewNote,
                now,
                cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
        };

        try
        {
            if (_context.Database.IsRelational())
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                    await saveAction();
                    await transaction.CommitAsync(cancellationToken);
                });
            }
            else
            {
                await saveAction();
            }
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw CreateConcurrentReviewConflict(ex);
        }
        catch (DbUpdateException ex) when (IsConcurrentApprovalUniqueConflict(ex))
        {
            throw CreateConcurrentReviewConflict(ex);
        }

        _logger.LogInformation("Admin {AdminId} đã phê duyệt đơn đăng ký Affiliate {AppId} cho UserId {UserId}",
            adminUserId, applicationId, application.UserId);

    }

    public async Task RejectAffiliateApplicationAsync(
        Guid applicationId,
        Guid adminUserId,
        string? reviewNote = null,
        CancellationToken cancellationToken = default)
    {
        var application = await _context.AffiliateApplications
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.AffiliateApplicationId == applicationId, cancellationToken);

        if (application == null)
        {
            throw new NotFoundException("Không tìm thấy đơn đăng ký Affiliate.");
        }

        if (application.User.EmailVerifiedAt == null)
        {
            throw new ConflictException("Người dùng chưa xác thực email bằng OTP, không thể từ chối hồ sơ Affiliate.");
        }

        if (!string.Equals(application.Status, "UNDER_REVIEW", StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException($"Đơn đăng ký Affiliate đang ở trạng thái {application.Status}; chỉ hồ sơ UNDER_REVIEW mới được từ chối.");
        }

        var now = DateTime.UtcNow;

        var saveAction = async () =>
        {
            application.Status = "REJECTED";
            application.ReviewedBy = adminUserId;
            application.ReviewedAt = now;
            application.ReviewNote = reviewNote;

            await AddReviewAuditAsync(
                AuditActions.AffiliateRejected,
                "AFFILIATE_APPLICATION",
                application.AffiliateApplicationId,
                adminUserId,
                "UNDER_REVIEW",
                "REJECTED",
                cancellationToken);
            await QueueReviewEmailAsync(
                application.UserId,
                application.User.Email,
                "AFFILIATE_REGISTRATION_REJECTED",
                "Đối tác tuyển dụng",
                approved: false,
                reviewNote,
                now,
                cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
        };

        try
        {
            if (_context.Database.IsRelational())
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                    await saveAction();
                    await transaction.CommitAsync(cancellationToken);
                });
            }
            else
            {
                await saveAction();
            }
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw CreateConcurrentReviewConflict(ex);
        }

        _logger.LogInformation("Admin {AdminId} đã từ chối đơn đăng ký Affiliate {AppId} cho UserId {UserId}",
            adminUserId, applicationId, application.UserId);

    }

    public async Task ApproveCompanyVerificationRequestAsync(
        Guid requestId,
        Guid adminUserId,
        string? reviewNote = null,
        CancellationToken cancellationToken = default)
    {
        var request = await _context.CompanyVerificationRequests
            .Include(r => r.Company)
            .Include(r => r.SubmittedByNavigation)
            .FirstOrDefaultAsync(r => r.CompanyVerificationRequestId == requestId, cancellationToken);

        if (request == null)
        {
            throw new NotFoundException("Không tìm thấy yêu cầu xác thực doanh nghiệp.");
        }

        if (request.SubmittedByNavigation.EmailVerifiedAt == null)
        {
            throw new ConflictException("Người dùng chưa xác thực email bằng OTP, không thể phê duyệt hồ sơ doanh nghiệp.");
        }

        if (!string.Equals(request.Status, "UNDER_REVIEW", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(request.Company.VerificationStatus, "UNDER_REVIEW", StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException($"Hồ sơ doanh nghiệp chưa sẵn sàng để phê duyệt (request: {request.Status}, company: {request.Company.VerificationStatus}).");
        }

        if (!string.Equals(request.SubmittedByNavigation.Status, "PENDING", StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException(
                "Tài khoản không còn ở trạng thái chờ phê duyệt. Vui lòng kiểm tra trạng thái mới nhất trước khi thao tác.",
                "ACCOUNT_NOT_PENDING_APPROVAL");
        }

        var clientRole = await _context.Roles
            .FirstOrDefaultAsync(
                role => role.Code == "CLIENT_COMPANY_USER" && role.IsActive,
                cancellationToken);
        if (clientRole == null)
        {
            throw new ConflictException("Role CLIENT_COMPANY_USER đang thiếu hoặc đã bị tắt; chưa thể phê duyệt hồ sơ.");
        }

        var companyUser = await _context.CompanyUsers
            .FirstOrDefaultAsync(
                companyUser => companyUser.CompanyId == request.CompanyId &&
                               companyUser.UserId == request.SubmittedBy,
                cancellationToken);
        if (companyUser == null)
        {
            throw new ConflictException(
                "Hồ sơ thành viên doanh nghiệp bị thiếu. Không thể phê duyệt cho đến khi dữ liệu đăng ký được khôi phục.",
                "COMPANY_MEMBERSHIP_MISSING");
        }

        var now = DateTime.UtcNow;

        var saveAction = async () =>
        {
            // 1. Cập nhật yêu cầu xác thực
            request.Status = "APPROVED";
            request.ReviewedBy = adminUserId;
            request.ReviewedAt = now;
            request.ReviewNote = reviewNote;

            // 2. Cập nhật trạng thái công ty
            request.Company.VerificationStatus = "VERIFIED";
            request.Company.VerifiedAt = now;
            request.Company.UpdatedAt = now;

            // 3. Kích hoạt đúng thành viên doanh nghiệp đã được tạo khi đăng ký.
            companyUser.Status = "ACTIVE";
            companyUser.UpdatedAt = now;
            _context.CompanyUsers.Update(companyUser);

            // 4. Gán Role CLIENT_COMPANY_USER
            var existingUserRole = await _context.UserRoles
                .FirstOrDefaultAsync(ur => ur.UserId == request.SubmittedBy && ur.RoleId == clientRole.RoleId, cancellationToken);

            if (existingUserRole == null)
            {
                await _context.UserRoles.AddAsync(new UserRole
                {
                    UserId = request.SubmittedBy,
                    RoleId = clientRole.RoleId,
                    AssignmentSource = "COMPANY_VERIFICATION",
                    AssignedBy = adminUserId,
                    AssignedAt = now,
                    Status = "ACTIVE"
                }, cancellationToken);
            }
            else
            {
                existingUserRole.Status = "ACTIVE";
                existingUserRole.AssignmentSource = "COMPANY_VERIFICATION";
                existingUserRole.AssignedBy = adminUserId;
                existingUserRole.AssignedAt = now;
                existingUserRole.RevokedAt = null;
                existingUserRole.RevokedBy = null;
                existingUserRole.RevokeReason = null;
                _context.UserRoles.Update(existingUserRole);
            }

            // 5. Kích hoạt tài khoản AppUser
            request.SubmittedByNavigation.Status = "ACTIVE";
            request.SubmittedByNavigation.AuthorizationConcurrencyToken = Guid.NewGuid();
            request.SubmittedByNavigation.UpdatedAt = now;

            await AddReviewAuditAsync(
                AuditActions.ClientApproved,
                "COMPANY_VERIFICATION_REQUEST",
                request.CompanyVerificationRequestId,
                adminUserId,
                "UNDER_REVIEW",
                "APPROVED",
                cancellationToken);
            await QueueReviewEmailAsync(
                request.SubmittedBy,
                request.SubmittedByNavigation.Email,
                "CLIENT_REGISTRATION_APPROVED",
                "Doanh nghiệp tuyển dụng",
                approved: true,
                reviewNote,
                now,
                cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
        };

        try
        {
            if (_context.Database.IsRelational())
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                    await saveAction();
                    await transaction.CommitAsync(cancellationToken);
                });
            }
            else
            {
                await saveAction();
            }
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw CreateConcurrentReviewConflict(ex);
        }
        catch (DbUpdateException ex) when (IsConcurrentApprovalUniqueConflict(ex))
        {
            throw CreateConcurrentReviewConflict(ex);
        }

        _logger.LogInformation("Admin {AdminId} đã phê duyệt doanh nghiệp {CompanyId} cho UserId {UserId}",
            adminUserId, request.CompanyId, request.SubmittedBy);

    }

    public async Task RejectCompanyVerificationRequestAsync(
        Guid requestId,
        Guid adminUserId,
        string? reviewNote = null,
        CancellationToken cancellationToken = default)
    {
        var request = await _context.CompanyVerificationRequests
            .Include(r => r.Company)
            .Include(r => r.SubmittedByNavigation)
            .FirstOrDefaultAsync(r => r.CompanyVerificationRequestId == requestId, cancellationToken);

        if (request == null)
        {
            throw new NotFoundException("Không tìm thấy yêu cầu xác thực doanh nghiệp.");
        }

        if (request.SubmittedByNavigation.EmailVerifiedAt == null)
        {
            throw new ConflictException("Người dùng chưa xác thực email bằng OTP, không thể từ chối hồ sơ doanh nghiệp.");
        }

        if (!string.Equals(request.Status, "UNDER_REVIEW", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(request.Company.VerificationStatus, "UNDER_REVIEW", StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException($"Hồ sơ doanh nghiệp chưa sẵn sàng để từ chối (request: {request.Status}, company: {request.Company.VerificationStatus}).");
        }

        var now = DateTime.UtcNow;

        var saveAction = async () =>
        {
            request.Status = "REJECTED";
            request.ReviewedBy = adminUserId;
            request.ReviewedAt = now;
            request.ReviewNote = reviewNote;

            request.Company.VerificationStatus = "REJECTED";
            request.Company.UpdatedAt = now;

            await AddReviewAuditAsync(
                AuditActions.ClientRejected,
                "COMPANY_VERIFICATION_REQUEST",
                request.CompanyVerificationRequestId,
                adminUserId,
                "UNDER_REVIEW",
                "REJECTED",
                cancellationToken);
            await QueueReviewEmailAsync(
                request.SubmittedBy,
                request.SubmittedByNavigation.Email,
                "CLIENT_REGISTRATION_REJECTED",
                "Doanh nghiệp tuyển dụng",
                approved: false,
                reviewNote,
                now,
                cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
        };

        try
        {
            if (_context.Database.IsRelational())
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                    await saveAction();
                    await transaction.CommitAsync(cancellationToken);
                });
            }
            else
            {
                await saveAction();
            }
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw CreateConcurrentReviewConflict(ex);
        }

        _logger.LogInformation("Admin {AdminId} đã từ chối xác thực doanh nghiệp {CompanyId}",
            adminUserId, request.CompanyId);

    }

    private async Task AddReviewAuditAsync(
        string action,
        string entityType,
        Guid entityId,
        Guid adminUserId,
        string oldStatus,
        string newStatus,
        CancellationToken cancellationToken)
    {
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            ActorUserId = adminUserId,
            OldValues = new { status = oldStatus },
            NewValues = new { status = newStatus },
            Source = AuditSources.Application
        }, cancellationToken);
    }

    private async Task QueueReviewEmailAsync(
        Guid userId,
        string recipientEmail,
        string templateCode,
        string accountLabel,
        bool approved,
        string? reviewNote,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var email = HRConnect.Application.Common.Email.HrConnectEmailTemplates
            .RegistrationReviewResult(accountLabel, approved, reviewNote);
        await _context.EmailOutboxes.AddAsync(new EmailOutbox
        {
            EmailOutboxId = Guid.NewGuid(),
            UserId = userId,
            RecipientEmail = recipientEmail,
            TemplateCode = templateCode,
            Subject = email.Subject,
            Payload = JsonSerializer.Serialize(new { accountLabel, approved, reviewNote }),
            Status = "PENDING",
            RetryCount = 0,
            NextRetryAt = now,
            CreatedAt = now
        }, cancellationToken);

        // Same result in the bell, pushed in real time after the commit.
        var isAffiliate = templateCode.StartsWith("AFFILIATE", StringComparison.Ordinal);
        await _context.Notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId,
            NotificationType = "ACCOUNT",
            Title = approved ? $"Hồ sơ {accountLabel.ToLowerInvariant()} đã được duyệt" : $"Hồ sơ {accountLabel.ToLowerInvariant()} chưa được duyệt",
            Message = approved
                ? "Tài khoản của bạn đã được kích hoạt. Bạn có thể bắt đầu sử dụng đầy đủ chức năng."
                : $"Quản trị viên chưa duyệt hồ sơ.{(string.IsNullOrWhiteSpace(reviewNote) ? string.Empty : $" Lý do: {reviewNote}")}",
            RelatedEntityType = isAffiliate ? "AFFILIATE" : "COMPANY",
            RelatedEntityId = userId,
            Metadata = JsonSerializer.Serialize(new { routeHint = isAffiliate ? "/affiliate/profile" : "/client/company" }),
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);
    }

    private static ConflictException CreateConcurrentReviewConflict(Exception exception)
    {
        return new ConflictException(
            "Hồ sơ vừa được xử lý bởi một Quản trị viên khác. Vui lòng tải lại trạng thái mới nhất.",
            "CONCURRENT_UPDATE",
            exception);
    }

    private static bool IsConcurrentApprovalUniqueConflict(DbUpdateException exception)
    {
        if (exception.InnerException is not PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation
            } postgresException)
        {
            return false;
        }

        return postgresException.ConstraintName is
            "user_role_pkey" or
            "affiliate_profile_user_id_key";
    }
}
