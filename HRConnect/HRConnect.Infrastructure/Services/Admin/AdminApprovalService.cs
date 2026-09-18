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
            throw new BadRequestException("Không tìm thấy đơn đăng ký Affiliate.");
        }

        var now = DateTime.UtcNow;

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
        var affiliateRole = await _context.Roles
            .FirstOrDefaultAsync(r => r.Code == "AFFILIATE_RECRUITER", cancellationToken);

        if (affiliateRole != null)
        {
            var existingUserRole = await _context.UserRoles
                .FirstOrDefaultAsync(ur => ur.UserId == application.UserId && ur.RoleId == affiliateRole.RoleId, cancellationToken);

            if (existingUserRole == null)
            {
                await _context.UserRoles.AddAsync(new UserRole
                {
                    UserId = application.UserId,
                    RoleId = affiliateRole.RoleId,
                    AssignmentSource = "ADMIN_APPROVAL",
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
        }

        // 4. Kích hoạt tài khoản AppUser
        application.User.Status = "ACTIVE";
        application.User.UpdatedAt = now;
        _context.AppUsers.Update(application.User);

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Admin {AdminId} đã phê duyệt đơn đăng ký Affiliate {AppId} cho UserId {UserId}",
            adminUserId, applicationId, application.UserId);

        // 5. Gửi email thông báo phê duyệt
        _ = Task.Run(async () =>
        {
            try
            {
                var subject = "HR Connect - Affiliate Recruiter Application Approved!";
                var bodyHtml = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #10B981; margin-top: 0;'>Chúc mừng bạn! Hồ sơ Affiliate Recruiter đã được phê duyệt</h2>
                        <p>Xin chào <strong>{application.DisplayName ?? application.User.DisplayName}</strong>,</p>
                        <p>Chúng tôi vui mừng thông báo rằng đơn đăng ký trở thành Đối tác tuyển dụng (Affiliate Recruiter) của bạn trên nền tảng HR Connect đã được Ban quản trị phê duyệt.</p>
                        <p>Bây giờ bạn đã có thể đăng nhập vào hệ thống và bắt đầu sử dụng đầy đủ các tính năng dành cho Đối tác tuyển dụng.</p>
                        <p style='margin-top: 24px;'><a href='#' style='background-color: #4F46E5; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>Đăng nhập ngay</a></p>
                    </div>";

                await _emailService.SendEmailAsync(application.User.Email, subject, bodyHtml, CancellationToken.None);
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
            throw new BadRequestException("Không tìm thấy đơn đăng ký Affiliate.");
        }

        var now = DateTime.UtcNow;

        application.Status = "REJECTED";
        application.ReviewedBy = adminUserId;
        application.ReviewedAt = now;
        application.ReviewNote = reviewNote;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Admin {AdminId} đã từ chối đơn đăng ký Affiliate {AppId} cho UserId {UserId}",
            adminUserId, applicationId, application.UserId);

        _ = Task.Run(async () =>
        {
            try
            {
                var subject = "HR Connect - Affiliate Recruiter Application Status Update";
                var bodyHtml = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #EF4444; margin-top: 0;'>Thông báo về hồ sơ đăng ký Affiliate Recruiter</h2>
                        <p>Xin chào <strong>{application.DisplayName ?? application.User.DisplayName}</strong>,</p>
                        <p>Rất tiếc, đơn đăng ký của bạn không được phê duyệt tại thời điểm này.</p>
                        {(string.IsNullOrWhiteSpace(reviewNote) ? "" : $"<p><strong>Lý do:</strong> {reviewNote}</p>")}
                        <p>Cảm ơn bạn đã quan tâm đến HR Connect.</p>
                    </div>";

                await _emailService.SendEmailAsync(application.User.Email, subject, bodyHtml, CancellationToken.None);
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
            throw new BadRequestException("Không tìm thấy yêu cầu xác thực doanh nghiệp.");
        }

        var now = DateTime.UtcNow;

        // 1. Cập nhật yêu cầu xác thực
        request.Status = "APPROVED";
        request.ReviewedBy = adminUserId;
        request.ReviewedAt = now;
        request.ReviewNote = reviewNote;

        // 2. Cập nhật trạng thái công ty
        request.Company.VerificationStatus = "VERIFIED";
        request.Company.VerifiedAt = now;
        request.Company.UpdatedAt = now;

        // 3. Gán Role CLIENT_COMPANY_USER
        var clientRole = await _context.Roles
            .FirstOrDefaultAsync(r => r.Code == "CLIENT_COMPANY_USER", cancellationToken);

        if (clientRole != null)
        {
            var existingUserRole = await _context.UserRoles
                .FirstOrDefaultAsync(ur => ur.UserId == request.SubmittedBy && ur.RoleId == clientRole.RoleId, cancellationToken);

            if (existingUserRole == null)
            {
                await _context.UserRoles.AddAsync(new UserRole
                {
                    UserId = request.SubmittedBy,
                    RoleId = clientRole.RoleId,
                    AssignmentSource = "ADMIN_APPROVAL",
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
        }

        // 4. Kích hoạt tài khoản AppUser
        request.SubmittedByNavigation.Status = "ACTIVE";
        request.SubmittedByNavigation.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Admin {AdminId} đã phê duyệt doanh nghiệp {CompanyId} cho UserId {UserId}",
            adminUserId, request.CompanyId, request.SubmittedBy);

        // 5. Gửi email phê duyệt
        _ = Task.Run(async () =>
        {
            try
            {
                var subject = "HR Connect - Company Registration Approved!";
                var bodyHtml = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #10B981; margin-top: 0;'>Tài khoản Doanh nghiệp của bạn đã được xác thực thành công</h2>
                        <p>Xin chào <strong>{request.SubmittedByNavigation.DisplayName}</strong> (Đại diện <strong>{request.Company.CompanyName}</strong>),</p>
                        <p>Hồ sơ đăng ký doanh nghiệp của bạn đã được Ban quản trị HR Connect xác thực và phê duyệt.</p>
                        <p>Bạn có thể đăng nhập ngay để đăng tin tuyển dụng và tìm kiếm ứng viên tiềm năng.</p>
                    </div>";

                await _emailService.SendEmailAsync(request.SubmittedByNavigation.Email, subject, bodyHtml, CancellationToken.None);
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
            throw new BadRequestException("Không tìm thấy yêu cầu xác thực doanh nghiệp.");
        }

        var now = DateTime.UtcNow;

        request.Status = "REJECTED";
        request.ReviewedBy = adminUserId;
        request.ReviewedAt = now;
        request.ReviewNote = reviewNote;

        request.Company.VerificationStatus = "REJECTED";
        request.Company.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Admin {AdminId} đã từ chối xác thực doanh nghiệp {CompanyId}",
            adminUserId, request.CompanyId);

        _ = Task.Run(async () =>
        {
            try
            {
                var subject = "HR Connect - Company Verification Status Update";
                var bodyHtml = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #EF4444; margin-top: 0;'>Thông báo về hồ sơ xác thực Doanh nghiệp</h2>
                        <p>Xin chào <strong>{request.SubmittedByNavigation.DisplayName}</strong>,</p>
                        <p>Rất tiếc, hồ sơ doanh nghiệp <strong>{request.Company.CompanyName}</strong> chưa thể được xác thực.</p>
                        {(string.IsNullOrWhiteSpace(reviewNote) ? "" : $"<p><strong>Lý do:</strong> {reviewNote}</p>")}
                    </div>";

                await _emailService.SendEmailAsync(request.SubmittedByNavigation.Email, subject, bodyHtml, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi gửi email từ chối Doanh nghiệp tới {Email}", request.SubmittedByNavigation.Email);
            }
        }, CancellationToken.None);
    }
}
