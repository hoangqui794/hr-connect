using HRConnect.Application.Common.Interfaces;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(
        ApplicationDbContext context,
        ILogger? logger = null,
        bool seedDemoAccounts = false,
        IPasswordHasher? passwordHasher = null,
        IEmailNormalizer? emailNormalizer = null,
        IPhoneNormalizer? phoneNormalizer = null,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        // 1. Khởi tạo 5 vai trò hệ thống nếu chưa có trong DB
        var defaultRoles = new (string Code, string Name, string Description)[]
        {
            ("CANDIDATE", "Candidate", "Ứng viên tìm việc"),
            ("AFFILIATE_RECRUITER", "Affiliate Recruiter", "Đối tác tuyển dụng / Cộng tác viên"),
            ("CLIENT_COMPANY_USER", "Client Company User", "Người đại diện doanh nghiệp tuyển dụng"),
            ("INTERNAL_HR", "Internal HR", "Nhân sự nội bộ HRConnect"),
            ("PLATFORM_ADMIN", "Platform Admin", "Quản trị viên toàn hệ thống")
        };

        foreach (var (code, name, description) in defaultRoles)
        {
            var exists = await context.Roles.AnyAsync(r => r.Code == code, cancellationToken);
            if (!exists)
            {
                await context.Roles.AddAsync(new Role
                {
                    RoleId = Guid.NewGuid(),
                    Code = code,
                    Name = name,
                    Description = description,
                    IsSystem = true,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                }, cancellationToken);
            }
        }
        await context.SaveChangesAsync(cancellationToken);

        // 2. Khởi tạo danh mục loại dịch vụ (Service Type) nếu chưa có (Idempotent seed)
        await ServiceTypeSeeder.SeedAsync(context, logger, cancellationToken);

        // 3. Khởi tạo ma trận quyền xem/nộp theo Service Type và Role.
        await ServiceTypeAllowedRoleSeeder.SeedAsync(context, logger, cancellationToken);

        // 4. Tự động nạp toàn bộ danh sách Permissions và Role-Permissions từ file Permission.md
        if (context.Database.IsRelational())
        {
            try
            {
                var sql = GetPermissionSeedSql();
                if (!string.IsNullOrWhiteSpace(sql))
                {
                    // Loại bỏ BEGIN; và COMMIT; vì EF Core tự quản lý transaction
                    var cleanedSql = sql.Replace("BEGIN;", "", StringComparison.OrdinalIgnoreCase)
                                        .Replace("COMMIT;", "", StringComparison.OrdinalIgnoreCase);

                    await context.Database.ExecuteSqlRawAsync(cleanedSql);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($">>> DatabaseSeeder: Lỗi nạp Permission seed data: {ex.Message}");
            }
        }

        // 5. Khởi tạo tài khoản phát triển / demo nếu được bật
        if (seedDemoAccounts)
        {
            await DemoAccountSeeder.SeedAsync(context, passwordHasher, emailNormalizer, phoneNormalizer, logger, cancellationToken);
            await CandidateTestJobSeeder.SeedAsync(context, logger, cancellationToken);
        }
    }

    private static string GetPermissionSeedSql()
    {
        // Thử tìm file Permission.md tại các đường dẫn tương đối
        var candidatePaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Permission.md"),
            Path.Combine(Directory.GetCurrentDirectory(), "Permission.md"),
            Path.Combine(Directory.GetCurrentDirectory(), "HRConnect", "Permission.md"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "Permission.md"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "Permission.md")
        };

        foreach (var path in candidatePaths)
        {
            if (File.Exists(path))
            {
                return File.ReadAllText(path);
            }
        }

        // Fallback: Nếu không tìm thấy file, sử dụng script nhúng trực tiếp
        return EmbeddedPermissionSeedSql;
    }

    private const string EmbeddedPermissionSeedSql = """
    INSERT INTO public.permission (code, resource, action, description)
    VALUES
        ('job.view', 'job', 'view', 'View published jobs'),
        ('notification.view_own', 'notification', 'view_own', 'View own notifications'),
        ('candidate.profile.view_own', 'candidate_profile', 'view_own', 'View own candidate profile'),
        ('candidate.profile.update_own', 'candidate_profile', 'update_own', 'Update own candidate profile'),
        ('cv.create', 'candidate_cv', 'create', 'Create own CV'),
        ('cv.view_own', 'candidate_cv', 'view_own', 'View own CV'),
        ('cv.update_own', 'candidate_cv', 'update_own', 'Update own CV'),
        ('cv.delete_own', 'candidate_cv', 'delete_own', 'Delete own CV'),
        ('application.create', 'application', 'create', 'Apply to a job'),
        ('application.view_own', 'application', 'view_own', 'View own job applications'),
        ('interview.view_own', 'interview', 'view_own', 'View own interview schedule'),
        ('offer.view_own', 'offer', 'view_own', 'View own offers'),
        ('offer.respond', 'offer', 'respond', 'Accept or decline own offer'),
        ('affiliate.apply', 'affiliate_application', 'create', 'Apply to become an affiliate recruiter'),
        ('affiliate.profile.view_own', 'affiliate_profile', 'view_own', 'View own affiliate profile'),
        ('affiliate.profile.update_own', 'affiliate_profile', 'update_own', 'Update own affiliate profile'),
        ('submission.create', 'submission', 'create', 'Submit a candidate and CV for a job'),
        ('submission.view_own', 'submission', 'view_own', 'View own submissions'),
        ('dispute.create', 'dispute', 'create', 'Raise duplicate or attribution dispute'),
        ('dispute.view_own', 'dispute', 'view_own', 'View own disputes'),
        ('commission.view_own', 'commission', 'view_own', 'View own commissions'),
        ('payout.view_own', 'payout', 'view_own', 'View own payouts'),
        ('affiliate.performance.view_own', 'affiliate_performance', 'view_own', 'View own affiliate performance'),
        ('company.profile.view_own', 'company', 'view_own', 'View own company profile'),
        ('company.profile.update_own', 'company', 'update_own', 'Update own company profile'),
        ('job.create', 'job', 'create', 'Create job posting'),
        ('job.view_own', 'job', 'view_own', 'View own company jobs'),
        ('job.update_own', 'job', 'update_own', 'Update own company jobs'),
        ('application.view_company', 'application', 'view_company', 'View applications for own company jobs'),
        ('candidate.review_company', 'candidate', 'review_company', 'Review candidates for own company jobs'),
        ('interview.create', 'interview', 'create', 'Create interviews'),
        ('interview.update', 'interview', 'update', 'Update interviews'),
        ('interview.view_company', 'interview', 'view_company', 'View interviews for own company jobs'),
        ('offer.create', 'offer', 'create', 'Create job offers'),
        ('offer.update', 'offer', 'update', 'Update job offers'),
        ('offer.view_company', 'offer', 'view_company', 'View offers for own company jobs'),
        ('company.view', 'company', 'view', 'View companies'),
        ('job.review', 'job', 'review', 'Review job postings'),
        ('job.publish', 'job', 'publish', 'Publish approved job postings'),
        ('candidate.view', 'candidate', 'view', 'View candidate information'),
        ('application.view', 'application', 'view', 'View applications'),
        ('application.screen', 'application', 'screen', 'Screen applications'),
        ('submission.view', 'submission', 'view', 'View submissions'),
        ('attribution.view', 'attribution', 'view', 'View affiliate attribution'),
        ('interview.manage', 'interview', 'manage', 'Manage interviews'),
        ('offer.manage', 'offer', 'manage', 'Manage job offers'),
        ('placement.manage', 'placement', 'manage', 'Manage placements'),
        ('probation.manage', 'probation', 'manage', 'Manage probation tracking'),
        ('warranty.manage', 'warranty', 'manage', 'Manage warranty tracking'),
        ('commission.view', 'commission', 'view', 'View commission records'),
        ('payout.view', 'payout', 'view', 'View payout records'),
        ('user.view', 'app_user', 'view', 'View platform users'),
        ('user.manage', 'app_user', 'manage', 'Manage platform users'),
        ('role.view', 'role', 'view', 'View system roles'),
        ('role.manage', 'role', 'manage', 'Manage system roles'),
        ('permission.view', 'permission', 'view', 'View system permissions'),
        ('permission.manage', 'permission', 'manage', 'Manage role permissions'),
        ('company.verify', 'company_verification_request', 'verify', 'Review and verify client companies'),
        ('affiliate.verify', 'affiliate_application', 'verify', 'Review and approve affiliate applications'),
        ('dispute.view', 'dispute', 'view', 'View disputes'),
        ('dispute.resolve', 'dispute', 'resolve', 'Resolve duplicate and attribution disputes'),
        ('commission.manage', 'commission', 'manage', 'Manage commissions'),
        ('payout.manage', 'payout', 'manage', 'Manage payouts'),
        ('system_config.view', 'system_config', 'view', 'View system configuration'),
        ('system_config.manage', 'system_config', 'manage', 'Manage system configuration'),
        ('report.view', 'report', 'view', 'View reports and dashboards'),
        ('audit.view', 'audit_log', 'view', 'View audit logs')
    ON CONFLICT (code) DO UPDATE
    SET resource = EXCLUDED.resource, action = EXCLUDED.action, description = EXCLUDED.description, is_active = true, updated_at = now();

    INSERT INTO public.role_permission (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM public.role r
    JOIN public.permission p ON p.code IN (
        'job.view', 'notification.view_own', 'candidate.profile.view_own', 'candidate.profile.update_own',
        'cv.create', 'cv.view_own', 'cv.update_own', 'cv.delete_own', 'application.create', 'application.view_own',
        'interview.view_own', 'offer.view_own', 'offer.respond', 'affiliate.apply'
    )
    WHERE r.code = 'CANDIDATE'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    INSERT INTO public.role_permission (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM public.role r
    JOIN public.permission p ON p.code IN (
        'job.view', 'notification.view_own', 'affiliate.profile.view_own', 'affiliate.profile.update_own',
        'submission.create', 'submission.view_own', 'dispute.create', 'dispute.view_own',
        'commission.view_own', 'payout.view_own', 'affiliate.performance.view_own'
    )
    WHERE r.code = 'AFFILIATE_RECRUITER'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    INSERT INTO public.role_permission (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM public.role r
    JOIN public.permission p ON p.code IN (
        'notification.view_own', 'company.profile.view_own', 'company.profile.update_own',
        'job.create', 'job.view_own', 'job.update_own', 'application.view_company', 'candidate.review_company',
        'interview.create', 'interview.update', 'interview.view_company', 'offer.create', 'offer.update', 'offer.view_company'
    )
    WHERE r.code = 'CLIENT_COMPANY_USER'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    INSERT INTO public.role_permission (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM public.role r
    JOIN public.permission p ON p.code IN (
        'job.view', 'notification.view_own', 'company.view', 'job.review', 'job.publish', 'candidate.view',
        'application.view', 'application.screen', 'submission.view', 'attribution.view',
        'interview.manage', 'offer.manage', 'placement.manage', 'probation.manage', 'warranty.manage',
        'commission.view', 'payout.view'
    )
    WHERE r.code = 'INTERNAL_HR'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    INSERT INTO public.role_permission (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM public.role r
    JOIN public.permission p ON p.code IN (
        'job.view', 'notification.view_own', 'user.view', 'user.manage', 'role.view', 'role.manage',
        'permission.view', 'permission.manage', 'company.verify', 'affiliate.verify',
        'dispute.view', 'dispute.resolve', 'commission.manage', 'payout.manage',
        'system_config.view', 'system_config.manage', 'report.view', 'audit.view'
    )
    WHERE r.code = 'PLATFORM_ADMIN'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
    """;
}
