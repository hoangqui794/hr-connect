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

        // Chống phê duyệt kép / kiểm tra trạng thái hợp lệ
        if (application.Status == "APPROVED" || application.Status == "REJECTED")
        {
            throw new ConflictException($"Đơn đăng ký Affiliate đã ở trạng thái {application.Status}, không thể phê duyệt lại.");
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
                var subject = "Chúc mừng! Hồ sơ Đối tác tuyển dụng của bạn đã được phê duyệt - HR Connect";
                var bodyHtml = @"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #10B981; margin-top: 0;'>Chúc mừng bạn!</h2>
                        <p>Hồ sơ đăng ký <strong>Đối tác tuyển dụng (Affiliate Recruiter)</strong> của bạn trên hệ thống HR Connect đã được Ban quản trị phê duyệt thành công.</p>
                        <p>Hiện tại bạn đã có thể đăng nhập vào hệ thống và bắt đầu sử dụng đầy đủ các tính năng dành cho Đối tác tuyển dụng.</p>
                        <p>Cảm ơn bạn đã đồng hành cùng HR Connect!</p>
                        <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                        <p style='color: #9CA3AF; font-size: 12px;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p>
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
            throw new NotFoundException("Không tìm thấy đơn đăng ký Affiliate.");
        }

        // Chống phê duyệt kép / kiểm tra trạng thái hợp lệ
        if (application.Status == "APPROVED" || application.Status == "REJECTED")
        {
            throw new ConflictException($"Đơn đăng ký Affiliate đã ở trạng thái {application.Status}, không thể từ chối lại.");
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
                var subject = "Thông báo về hồ sơ đăng ký Đối tác tuyển dụng - HR Connect";
                var reasonText = string.IsNullOrWhiteSpace(reviewNote) ? "" : $"<p><strong>Lý do từ chối:</strong> {reviewNote}</p>";
                var bodyHtml = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #EF4444; margin-top: 0;'>Thông báo kết quả hồ sơ Đối tác tuyển dụng</h2>
                        <p>Cảm ơn bạn đã quan tâm và đăng ký trở thành Đối tác tuyển dụng trên hệ thống HR Connect.</p>
                        <p>Rất tiếc, hồ sơ đăng ký của bạn chưa được phê duyệt ở thời điểm hiện tại.</p>
                        {reasonText}
                        <p>Nếu bạn cần hỗ trợ thêm thông tin hoặc có thắc mắc, vui lòng liên hệ với bộ phận hỗ trợ của HR Connect.</p>
                        <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                        <p style='color: #9CA3AF; font-size: 12px;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p>
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
            throw new NotFoundException("Không tìm thấy yêu cầu xác thực doanh nghiệp.");
        }

        // Chống phê duyệt kép / kiểm tra trạng thái hợp lệ
        if (request.Status == "APPROVED" || request.Status == "REJECTED")
        {
            throw new ConflictException($"Yêu cầu xác thực doanh nghiệp đã ở trạng thái {request.Status}, không thể phê duyệt lại.");
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
                var subject = "Chúc mừng! Hồ sơ Doanh nghiệp của bạn đã được phê duyệt - HR Connect";
                var bodyHtml = @"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #10B981; margin-top: 0;'>Chúc mừng bạn!</h2>
                        <p>Hồ sơ xác thực <strong>Doanh nghiệp tuyển dụng</strong> của bạn trên hệ thống HR Connect đã được Ban quản trị phê duyệt thành công.</p>
                        <p>Tài khoản của bạn đã được kích hoạt. Hiện tại bạn có thể đăng nhập và sử dụng toàn bộ tính năng tuyển dụng và quản trị doanh nghiệp.</p>
                        <p>Cảm ơn bạn đã tin tưởng và đồng hành cùng HR Connect!</p>
                        <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                        <p style='color: #9CA3AF; font-size: 12px;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p>
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
            throw new NotFoundException("Không tìm thấy yêu cầu xác thực doanh nghiệp.");
        }

        // Chống phê duyệt kép / kiểm tra trạng thái hợp lệ
        if (request.Status == "APPROVED" || request.Status == "REJECTED")
        {
            throw new ConflictException($"Yêu cầu xác thực doanh nghiệp đã ở trạng thái {request.Status}, không thể từ chối lại.");
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
                var subject = "Thông báo về hồ sơ xác thực Doanh nghiệp - HR Connect";
                var reasonText = string.IsNullOrWhiteSpace(reviewNote) ? "" : $"<p><strong>Lý do từ chối:</strong> {reviewNote}</p>";
                var bodyHtml = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                        <h2 style='color: #EF4444; margin-top: 0;'>Thông báo kết quả xác thực Doanh nghiệp</h2>
                        <p>Cảm ơn bạn đã đăng ký hồ sơ Doanh nghiệp trên hệ thống HR Connect.</p>
                        <p>Rất tiếc, yêu cầu xác thực doanh nghiệp của bạn chưa được Ban quản trị phê duyệt ở thời điểm hiện tại.</p>
                        {reasonText}
                        <p>Nếu bạn cần hỗ trợ thêm thông tin hoặc muốn bổ sung tài liệu xác thực, vui lòng liên hệ với bộ phận hỗ trợ của HR Connect.</p>
                        <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;' />
                        <p style='color: #9CA3AF; font-size: 12px;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p>
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
