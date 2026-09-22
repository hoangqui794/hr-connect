using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Services.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

public static class DemoAccountSeeder
{
    public const string InitialDemoPassword = "111111Aa@";

    // Demo account emails
    public const string AdminEmail = "admin@gmail.com";
    public const string InternalHrEmail = "internalhr@gmail.com";
    public const string InternalHr2Email = "internalhr2@gmail.com";
    public const string CandidateEmail = "candidate@gmail.com";
    public const string Candidate2Email = "candidate2@gmail.com";
    public const string AffiliateEmail = "affiliate@gmail.com";
    public const string Affiliate2Email = "affiliate2@gmail.com";
    public const string ClientEmail = "client@gmail.com";
    public const string Client2Email = "client2@gmail.com";

    // Demo account phones
    public const string CandidatePhone = "0900000001";
    public const string AffiliatePhone = "0900000002";
    public const string ClientPhone = "0900000003";
    public const string InternalHrPhone = "0900000004";

    public const string Candidate2Phone = "0900000011";
    public const string Affiliate2Phone = "0900000012";
    public const string Client2Phone = "0900000013";
    public const string InternalHr2Phone = "0900000014";

    public const string DemoCompanyName = "HR Connect Demo Company";
    public const string DemoCompanyTaxCode = "DEMO-TAX-001";

    public const string DemoCompany2Name = "HR Connect Demo Company 2";
    public const string DemoCompany2TaxCode = "DEMO-TAX-002";

    /// <summary>
    /// Nạp các tài khoản demo/phát triển cho toàn bộ các vai trò trong hệ thống (Platform Admin, Internal HR, Candidate, Affiliate Recruiter, Client Company User),
    /// đồng thời tạo tài khoản thứ 2 cho các vai trò nghiệp vụ nhằm hỗ trợ kiểm thử đa người dùng (multi-user testing).
    /// Hoàn toàn idempotent và không bao giờ ghi đè mật khẩu của tài khoản đã tồn tại.
    /// </summary>
    public static async Task SeedAsync(
        ApplicationDbContext context,
        IPasswordHasher? passwordHasher = null,
        IEmailNormalizer? emailNormalizer = null,
        IPhoneNormalizer? phoneNormalizer = null,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        passwordHasher ??= new PasswordHasher();
        emailNormalizer ??= new EmailNormalizer();
        phoneNormalizer ??= new PhoneNormalizer();

        try
        {
            var now = DateTime.UtcNow;

            // 1. Khởi tạo Platform Admin (Cần có trước để đóng vai trò reviewer/assignedBy cho các tài khoản khác)
            var adminUser = await EnsurePlatformAdminAsync(context, passwordHasher, emailNormalizer, now, logger, cancellationToken);

            // 2. Khởi tạo Internal HR (Nhân sự nội bộ: internalhr@gmail.com và internalhr2@gmail.com)
            await EnsureInternalHrAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                adminUser.UserId, InternalHrEmail, "Demo Internal HR", InternalHrPhone,
                "HR001", "Internal Recruiter", "Recruitment", now, logger, cancellationToken);

            await EnsureInternalHrAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                adminUser.UserId, InternalHr2Email, "Demo Internal HR 2", InternalHr2Phone,
                "HR002", "Internal Recruiter", "Recruitment", now, logger, cancellationToken);

            // 3. Khởi tạo Candidate (Ứng viên: candidate@gmail.com và candidate2@gmail.com)
            await EnsureCandidateAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                CandidateEmail, "Demo Candidate", CandidatePhone, now, logger, cancellationToken);

            await EnsureCandidateAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                Candidate2Email, "Demo Candidate 2", Candidate2Phone, now, logger, cancellationToken);

            // 4. Khởi tạo Affiliate Recruiter (Cộng tác viên: affiliate@gmail.com và affiliate2@gmail.com)
            await EnsureAffiliateAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                adminUser.UserId, AffiliateEmail, "Demo Affiliate", AffiliatePhone, now, logger, cancellationToken);

            await EnsureAffiliateAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                adminUser.UserId, Affiliate2Email, "Demo Affiliate 2", Affiliate2Phone, now, logger, cancellationToken);

            // 5. Khởi tạo Client Company Users (client@gmail.com - Company 1, client2@gmail.com - Company 2)
            // Do EF Core cấu hình quan hệ 1-1 giữa Company và CompanyUser (WithOne), việc tạo Company 2 cho client2
            // tuân thủ chặt chẽ domain model và hỗ trợ kiểm thử đa doanh nghiệp / cách ly dữ liệu giữa các công ty.
            await EnsureClientWithCompanyAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                adminUser.UserId, ClientEmail, "Demo Client", ClientPhone,
                DemoCompanyName, DemoCompanyTaxCode, now, logger, cancellationToken);

            await EnsureClientWithCompanyAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                adminUser.UserId, Client2Email, "Demo Client 2", Client2Phone,
                DemoCompany2Name, DemoCompany2TaxCode, now, logger, cancellationToken);

            logger?.LogInformation("Demo accounts seeding completed successfully (9 accounts).");
        }
        catch (DbUpdateException ex)
        {
            logger?.LogWarning(ex, "Demo accounts seed encountered a concurrency conflict. Records may have already been inserted by another instance.");
            foreach (var entry in context.ChangeTracker.Entries())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.State = EntityState.Detached;
                }
            }
        }
    }

    /// <summary>
    /// 1. Đảm bảo Platform Admin (admin@gmail.com) tồn tại kèm AdminProfile và UserRole PLATFORM_ADMIN
    /// </summary>
    private static async Task<AppUser> EnsurePlatformAdminAsync(
        ApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IEmailNormalizer emailNormalizer,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = emailNormalizer.Normalize(AdminEmail);

        var user = await context.AppUsers
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user == null)
        {
            user = new AppUser
            {
                UserId = Guid.NewGuid(),
                Email = normalizedEmail,
                PasswordHash = passwordHasher.Hash(InitialDemoPassword),
                DisplayName = "Platform Admin",
                Status = "ACTIVE",
                EmailVerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.AppUsers.AddAsync(user, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created demo Platform Admin account: {Email}", AdminEmail);
        }

        // Đảm bảo AdminProfile tồn tại
        var adminProfile = await context.AdminProfiles
            .FirstOrDefaultAsync(ap => ap.UserId == user.UserId || ap.EmployeeCode == "ADM001", cancellationToken);

        if (adminProfile == null)
        {
            adminProfile = new AdminProfile
            {
                AdminProfileId = Guid.NewGuid(),
                UserId = user.UserId,
                EmployeeCode = "ADM001",
                JobTitle = "Platform Administrator",
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.AdminProfiles.AddAsync(adminProfile, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created AdminProfile for {Email} with EmployeeCode ADM001", AdminEmail);
        }
        else if (adminProfile.UserId != user.UserId)
        {
            adminProfile.UserId = user.UserId;
            adminProfile.UpdatedAt = now;
            context.AdminProfiles.Update(adminProfile);
            await context.SaveChangesAsync(cancellationToken);
        }

        // Đảm bảo gán vai trò PLATFORM_ADMIN
        await EnsureUserRoleAsync(context, user.UserId, "PLATFORM_ADMIN", "ADMIN_PROVISIONING", null, now, logger, cancellationToken);

        return user;
    }

    /// <summary>
    /// 2. Đảm bảo tài khoản Internal HR tồn tại kèm InternalHrProfile và UserRole INTERNAL_HR
    /// </summary>
    private static async Task<AppUser> EnsureInternalHrAsync(
        ApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        Guid adminUserId,
        string email,
        string displayName,
        string rawPhone,
        string employeeCode,
        string jobTitle,
        string department,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = emailNormalizer.Normalize(email);
        var normalizedPhone = phoneNormalizer.Normalize(rawPhone);

        var user = await context.AppUsers
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user == null)
        {
            user = new AppUser
            {
                UserId = Guid.NewGuid(),
                Email = normalizedEmail,
                PasswordHash = passwordHasher.Hash(InitialDemoPassword),
                DisplayName = displayName,
                Phone = rawPhone,
                NormalizedPhone = normalizedPhone,
                Status = "ACTIVE",
                EmailVerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.AppUsers.AddAsync(user, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created demo Internal HR account: {Email}", email);
        }

        // Đảm bảo InternalHrProfile tồn tại
        var hrProfile = await context.InternalHrProfiles
            .FirstOrDefaultAsync(p => p.UserId == user.UserId || p.EmployeeCode == employeeCode, cancellationToken);

        if (hrProfile == null)
        {
            hrProfile = new InternalHrProfile
            {
                HrProfileId = Guid.NewGuid(),
                UserId = user.UserId,
                EmployeeCode = employeeCode,
                JobTitle = jobTitle,
                Department = department,
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.InternalHrProfiles.AddAsync(hrProfile, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created InternalHrProfile for {Email} with EmployeeCode {Code}", email, employeeCode);
        }
        else if (hrProfile.UserId != user.UserId)
        {
            hrProfile.UserId = user.UserId;
            hrProfile.UpdatedAt = now;
            context.InternalHrProfiles.Update(hrProfile);
            await context.SaveChangesAsync(cancellationToken);
        }

        // Đảm bảo gán vai trò INTERNAL_HR
        await EnsureUserRoleAsync(context, user.UserId, "INTERNAL_HR", "ADMIN_PROVISIONING", adminUserId, now, logger, cancellationToken);

        return user;
    }

    /// <summary>
    /// 3. Đảm bảo Candidate tồn tại kèm Candidate profile và UserRole CANDIDATE
    /// </summary>
    private static async Task<AppUser> EnsureCandidateAsync(
        ApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        string email,
        string displayName,
        string rawPhone,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = emailNormalizer.Normalize(email);
        var normalizedPhone = phoneNormalizer.Normalize(rawPhone);

        var user = await context.AppUsers
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user == null)
        {
            user = new AppUser
            {
                UserId = Guid.NewGuid(),
                Email = normalizedEmail,
                PasswordHash = passwordHasher.Hash(InitialDemoPassword),
                DisplayName = displayName,
                Phone = rawPhone,
                NormalizedPhone = normalizedPhone,
                Status = "ACTIVE",
                EmailVerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.AppUsers.AddAsync(user, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created demo Candidate account: {Email}", email);
        }

        // Đảm bảo hồ sơ Candidate tồn tại và liên kết đúng UserId
        var candidate = await context.Candidates
            .FirstOrDefaultAsync(c => c.UserId == user.UserId || c.NormalizedEmail == normalizedEmail, cancellationToken);

        if (candidate == null)
        {
            candidate = new Candidate
            {
                CandidateId = Guid.NewGuid(),
                UserId = user.UserId,
                FullName = displayName,
                Email = normalizedEmail,
                NormalizedEmail = normalizedEmail,
                Phone = rawPhone,
                NormalizedPhone = normalizedPhone,
                ProfileVisibility = "PRIVATE",
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.Candidates.AddAsync(candidate, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created Candidate record for {Email}", email);
        }
        else if (candidate.UserId == null)
        {
            candidate.UserId = user.UserId;
            candidate.UpdatedAt = now;
            context.Candidates.Update(candidate);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Linked existing Candidate record to UserId {UserId}", user.UserId);
        }

        // Đảm bảo gán vai trò CANDIDATE
        await EnsureUserRoleAsync(context, user.UserId, "CANDIDATE", "REGISTRATION", null, now, logger, cancellationToken);

        return user;
    }

    /// <summary>
    /// 4. Đảm bảo Affiliate Recruiter tồn tại ở trạng thái APPROVED kèm AffiliateApplication, AffiliateProfile và UserRole AFFILIATE_RECRUITER
    /// </summary>
    private static async Task<AppUser> EnsureAffiliateAsync(
        ApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        Guid adminUserId,
        string email,
        string displayName,
        string rawPhone,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = emailNormalizer.Normalize(email);
        var normalizedPhone = phoneNormalizer.Normalize(rawPhone);

        var user = await context.AppUsers
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user == null)
        {
            user = new AppUser
            {
                UserId = Guid.NewGuid(),
                Email = normalizedEmail,
                PasswordHash = passwordHasher.Hash(InitialDemoPassword),
                DisplayName = displayName,
                Phone = rawPhone,
                NormalizedPhone = normalizedPhone,
                Status = "ACTIVE",
                EmailVerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.AppUsers.AddAsync(user, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created demo Affiliate account: {Email}", email);
        }

        // Đảm bảo AffiliateApplication ở trạng thái APPROVED
        var application = await context.AffiliateApplications
            .FirstOrDefaultAsync(a => a.UserId == user.UserId, cancellationToken);

        if (application == null)
        {
            application = new AffiliateApplication
            {
                AffiliateApplicationId = Guid.NewGuid(),
                UserId = user.UserId,
                AffiliateType = "RECRUITER",
                DisplayName = displayName,
                Phone = rawPhone,
                SubmittedData = "{}",
                Status = "APPROVED",
                ReviewedBy = adminUserId,
                ReviewNote = "Approved via demo account seeder",
                SubmittedAt = now,
                ReviewedAt = now
            };

            await context.AffiliateApplications.AddAsync(application, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created approved AffiliateApplication for {Email}", email);
        }
        else if (application.Status != "APPROVED")
        {
            application.Status = "APPROVED";
            application.ReviewedBy = adminUserId;
            application.ReviewedAt = now;
            context.AffiliateApplications.Update(application);
            await context.SaveChangesAsync(cancellationToken);
        }

        // Đảm bảo AffiliateProfile ở trạng thái ACTIVE
        var profile = await context.AffiliateProfiles
            .FirstOrDefaultAsync(ap => ap.UserId == user.UserId, cancellationToken);

        if (profile == null)
        {
            profile = new AffiliateProfile
            {
                AffiliateId = Guid.NewGuid(),
                UserId = user.UserId,
                AffiliateType = "RECRUITER",
                DisplayName = displayName,
                Phone = rawPhone,
                Status = "ACTIVE",
                VerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.AffiliateProfiles.AddAsync(profile, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created active AffiliateProfile for {Email}", email);
        }
        else if (profile.Status != "ACTIVE")
        {
            profile.Status = "ACTIVE";
            profile.VerifiedAt ??= now;
            profile.UpdatedAt = now;
            context.AffiliateProfiles.Update(profile);
            await context.SaveChangesAsync(cancellationToken);
        }

        // Đảm bảo gán vai trò AFFILIATE_RECRUITER
        await EnsureUserRoleAsync(context, user.UserId, "AFFILIATE_RECRUITER", "AFFILIATE_APPROVAL", adminUserId, now, logger, cancellationToken);

        return user;
    }

    /// <summary>
    /// 5. Đảm bảo Client Company User tồn tại kèm Company, CompanyUser, CompanyVerificationRequest (APPROVED)
    /// và vai trò CLIENT_COMPANY_USER
    /// </summary>
    private static async Task<AppUser> EnsureClientWithCompanyAsync(
        ApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        Guid adminUserId,
        string email,
        string displayName,
        string rawPhone,
        string companyName,
        string taxCode,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = emailNormalizer.Normalize(email);
        var normalizedPhone = phoneNormalizer.Normalize(rawPhone);

        // 5.1 Đảm bảo AppUser tồn tại
        var user = await context.AppUsers
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user == null)
        {
            user = new AppUser
            {
                UserId = Guid.NewGuid(),
                Email = normalizedEmail,
                PasswordHash = passwordHasher.Hash(InitialDemoPassword),
                DisplayName = displayName,
                Phone = rawPhone,
                NormalizedPhone = normalizedPhone,
                Status = "ACTIVE",
                EmailVerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.AppUsers.AddAsync(user, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created demo Client account: {Email}", email);
        }

        // 5.2 Đảm bảo Company tồn tại
        var company = await context.Companies
            .FirstOrDefaultAsync(c => c.CompanyName == companyName || c.TaxCode == taxCode, cancellationToken);

        if (company == null)
        {
            company = new Company
            {
                CompanyId = Guid.NewGuid(),
                CompanyName = companyName,
                TaxCode = taxCode,
                Industry = "Technology",
                CompanySize = "50-100",
                VerificationStatus = "VERIFIED",
                VerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.Companies.AddAsync(company, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created demo Company: {CompanyName}", companyName);
        }

        // 5.3 Đảm bảo CompanyUser liên kết Client với Company
        var companyUser = await context.CompanyUsers
            .FirstOrDefaultAsync(cu => cu.CompanyId == company.CompanyId && cu.UserId == user.UserId, cancellationToken);

        if (companyUser == null)
        {
            companyUser = new CompanyUser
            {
                CompanyUserId = Guid.NewGuid(),
                CompanyId = company.CompanyId,
                UserId = user.UserId,
                RoleInCompany = "HR Manager",
                IsPrimaryContact = true,
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.CompanyUsers.AddAsync(companyUser, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Linked Client {Email} to Company {CompanyName}", email, companyName);
        }

        // 5.4 Đảm bảo CompanyVerificationRequest ở trạng thái APPROVED
        var verificationRequest = await context.CompanyVerificationRequests
            .FirstOrDefaultAsync(cvr => cvr.CompanyId == company.CompanyId, cancellationToken);

        if (verificationRequest == null)
        {
            verificationRequest = new CompanyVerificationRequest
            {
                CompanyVerificationRequestId = Guid.NewGuid(),
                CompanyId = company.CompanyId,
                SubmittedBy = user.UserId,
                ReviewedBy = adminUserId,
                Status = "APPROVED",
                SubmittedPayload = "{}",
                ReviewNote = "Approved via demo account seeder",
                SubmittedAt = now,
                ReviewedAt = now
            };

            await context.CompanyVerificationRequests.AddAsync(verificationRequest, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created approved CompanyVerificationRequest for {CompanyName}", companyName);
        }
        else if (verificationRequest.Status != "APPROVED")
        {
            verificationRequest.Status = "APPROVED";
            verificationRequest.ReviewedBy = adminUserId;
            verificationRequest.ReviewedAt = now;
            context.CompanyVerificationRequests.Update(verificationRequest);
            await context.SaveChangesAsync(cancellationToken);
        }

        // 5.5 Đảm bảo gán vai trò CLIENT_COMPANY_USER
        await EnsureUserRoleAsync(context, user.UserId, "CLIENT_COMPANY_USER", "COMPANY_VERIFICATION", adminUserId, now, logger, cancellationToken);

        return user;
    }

    /// <summary>
    /// Đảm bảo một vai trò cụ thể được gán cho người dùng một cách idempotent
    /// </summary>
    private static async Task EnsureUserRoleAsync(
        ApplicationDbContext context,
        Guid userId,
        string roleCode,
        string assignmentSource,
        Guid? assignedBy,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        var role = await context.Roles
            .FirstOrDefaultAsync(r => r.Code == roleCode, cancellationToken);

        if (role == null)
        {
            logger?.LogError("Role {RoleCode} not found in database. Make sure roles are seeded first.", roleCode);
            return;
        }

        var existingUserRole = await context.UserRoles
            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == role.RoleId, cancellationToken);

        if (existingUserRole == null)
        {
            var userRole = new UserRole
            {
                UserId = userId,
                RoleId = role.RoleId,
                AssignmentSource = assignmentSource,
                AssignedBy = assignedBy,
                AssignedAt = now,
                Status = "ACTIVE"
            };

            await context.UserRoles.AddAsync(userRole, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Assigned role {RoleCode} to UserId {UserId} with source {Source}", roleCode, userId, assignmentSource);
        }
        else if (existingUserRole.Status != "ACTIVE")
        {
            existingUserRole.Status = "ACTIVE";
            existingUserRole.AssignedAt = now;
            existingUserRole.AssignedBy = assignedBy ?? existingUserRole.AssignedBy;
            context.UserRoles.Update(existingUserRole);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Re-activated role {RoleCode} for UserId {UserId}", roleCode, userId);
        }
    }
}
