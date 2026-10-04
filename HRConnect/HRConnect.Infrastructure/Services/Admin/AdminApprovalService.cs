using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.Admin;

public class AdminApprovalService : IAdminApprovalService
{
    private readonly ApplicationDbContext _context;
    private readonly IEmailService _emailService;
    private readonly ILogger<AdminApprovalService> _logger;

    public AdminApprovalService(
        ApplicationDbContext context,
        IEmailService emailService,
        ILogger<AdminApprovalService> logger)
    {
        _context = context;
        _emailService = emailService;
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

        var affiliateRole = await _context.Roles
            .FirstOrDefaultAsync(
                role => role.Code == "AFFILIATE_RECRUITER" && role.IsActive,
                cancellationToken);
        if (affiliateRole == null)
        {
            throw new ConflictException("Role AFFILIATE_RECRUITER đang thiếu hoặc đã bị tắt; chưa thể phê duyệt hồ sơ.");
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

            // 3. Gán Role AFFILIATE_RECRUITER
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
                _context.UserRoles.Update(existingUserRole);
            }

            // 4. Kích hoạt tài khoản AppUser
            application.User.Status = "ACTIVE";
            application.User.UpdatedAt = now;
            _context.AppUsers.Update(application.User);

            await _context.SaveChangesAsync(cancellationToken);
        };

        if (_context.Database.IsRelational())
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                await saveAction();
                await transaction.CommitAsync(cancellationToken);
            });
        }
        else
        {
            await saveAction();
        }

        _logger.LogInformation("Admin {AdminId} đã phê duyệt đơn đăng ký Affiliate {AppId} cho UserId {UserId}",
            adminUserId, applicationId, application.UserId);

        // 5. Gửi email thông báo phê duyệt
        _ = Task.Run(async () =>
        {
            try
            {
                var email = HRConnect.Application.Common.Email.HrConnectEmailTemplates
                    .RegistrationReviewResult("Đối tác tuyển dụng", approved: true);
                await _emailService.SendEmailAsync(
                    application.User.Email, email.Subject, email.HtmlBody, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi gửi email thông báo phê duyệt Affiliate tới {Email}", application.User.Email);
            }
        }, CancellationToken.None);
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

            await _context.SaveChangesAsync(cancellationToken);
        };

        if (_context.Database.IsRelational())
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                await saveAction();
                await transaction.CommitAsync(cancellationToken);
            });
        }
        else
        {
            await saveAction();
        }

        _logger.LogInformation("Admin {AdminId} đã từ chối đơn đăng ký Affiliate {AppId} cho UserId {UserId}",
            adminUserId, applicationId, application.UserId);

        _ = Task.Run(async () =>
        {
            try
            {
                var email = HRConnect.Application.Common.Email.HrConnectEmailTemplates
                    .RegistrationReviewResult("Đối tác tuyển dụng", approved: false, reviewNote);
                await _emailService.SendEmailAsync(
                    application.User.Email, email.Subject, email.HtmlBody, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi gửi email từ chối Affiliate tới {Email}", application.User.Email);
            }
        }, CancellationToken.None);
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

        var clientRole = await _context.Roles
            .FirstOrDefaultAsync(
                role => role.Code == "CLIENT_COMPANY_USER" && role.IsActive,
                cancellationToken);
        if (clientRole == null)
        {
            throw new ConflictException("Role CLIENT_COMPANY_USER đang thiếu hoặc đã bị tắt; chưa thể phê duyệt hồ sơ.");
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

            // 3. Cập nhật trạng thái CompanyUser (nếu có)
            var companyUser = await _context.CompanyUsers
                .FirstOrDefaultAsync(cu => cu.CompanyId == request.CompanyId && cu.UserId == request.SubmittedBy, cancellationToken);
            if (companyUser != null)
            {
                companyUser.Status = "ACTIVE";
                companyUser.UpdatedAt = now;
                _context.CompanyUsers.Update(companyUser);
            }

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
                _context.UserRoles.Update(existingUserRole);
            }

            // 5. Kích hoạt tài khoản AppUser
            request.SubmittedByNavigation.Status = "ACTIVE";
            request.SubmittedByNavigation.UpdatedAt = now;

            await _context.SaveChangesAsync(cancellationToken);
        };

        if (_context.Database.IsRelational())
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                await saveAction();
                await transaction.CommitAsync(cancellationToken);
            });
        }
        else
        {
            await saveAction();
        }

        _logger.LogInformation("Admin {AdminId} đã phê duyệt doanh nghiệp {CompanyId} cho UserId {UserId}",
            adminUserId, request.CompanyId, request.SubmittedBy);

        // 6. Gửi email phê duyệt
        _ = Task.Run(async () =>
        {
            try
            {
                var email = HRConnect.Application.Common.Email.HrConnectEmailTemplates
                    .RegistrationReviewResult("Doanh nghiệp tuyển dụng", approved: true);
                await _emailService.SendEmailAsync(
                    request.SubmittedByNavigation.Email, email.Subject, email.HtmlBody, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi gửi email thông báo phê duyệt Doanh nghiệp tới {Email}", request.SubmittedByNavigation.Email);
            }
        }, CancellationToken.None);
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

            await _context.SaveChangesAsync(cancellationToken);
        };

        if (_context.Database.IsRelational())
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                await saveAction();
                await transaction.CommitAsync(cancellationToken);
            });
        }
        else
        {
            await saveAction();
        }

        _logger.LogInformation("Admin {AdminId} đã từ chối xác thực doanh nghiệp {CompanyId}",
            adminUserId, request.CompanyId);

        _ = Task.Run(async () =>
        {
            try
            {
                var email = HRConnect.Application.Common.Email.HrConnectEmailTemplates
                    .RegistrationReviewResult("Doanh nghiệp tuyển dụng", approved: false, reviewNote);
                await _emailService.SendEmailAsync(
                    request.SubmittedByNavigation.Email, email.Subject, email.HtmlBody, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi gửi email từ chối Doanh nghiệp tới {Email}", request.SubmittedByNavigation.Email);
            }
        }, CancellationToken.None);
    }
}
