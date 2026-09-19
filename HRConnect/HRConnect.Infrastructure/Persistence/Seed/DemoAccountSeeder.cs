using System;
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
    private const string InitialDemoPassword = "111111Aa@";

    /// <summary>
    /// Nạp các tài khoản demo/phát triển (Platform Admin, Candidate, Affiliate Recruiter, Client Company User)
    /// một cách an toàn và idempotent. Không bao giờ ghi đè mật khẩu của các tài khoản đã tồn tại.
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

            // 1. Khởi tạo Platform Admin (Cần có trước để đóng vai trò reviewer cho Affiliate và Client)
            var adminUser = await EnsurePlatformAdminAsync(context, passwordHasher, emailNormalizer, now, logger, cancellationToken);

            // 2. Khởi tạo Candidate
            await EnsureCandidateAsync(context, passwordHasher, emailNormalizer, phoneNormalizer, now, logger, cancellationToken);

            // 3. Khởi tạo Affiliate Recruiter (Trạng thái APPROVED hoàn chỉnh)
            await EnsureAffiliateAsync(context, passwordHasher, emailNormalizer, phoneNormalizer, adminUser.UserId, now, logger, cancellationToken);

            // 4. Khởi tạo Client Company User (Trạng thái APPROVED hoàn chỉnh kèm Company & CompanyUser)
            await EnsureClientAsync(context, passwordHasher, emailNormalizer, phoneNormalizer, adminUser.UserId, now, logger, cancellationToken);

            logger?.LogInformation("Demo accounts seeding completed successfully.");
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
        const string email = "admin@gmail.com";
        var normalizedEmail = emailNormalizer.Normalize(email);

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
            logger?.LogInformation("Created demo Platform Admin account: {Email}", email);
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
            logger?.LogInformation("Created AdminProfile for {Email} with EmployeeCode ADM001", email);
        }

        // Đảm bảo gán vai trò PLATFORM_ADMIN
        await EnsureUserRoleAsync(context, user.UserId, "PLATFORM_ADMIN", "ADMIN_PROVISIONING", null, now, logger, cancellationToken);

        return user;
    }

    /// <summary>
    /// 2. Đảm bảo Candidate (candidate@gmail.com) tồn tại kèm Candidate profile và UserRole CANDIDATE
    /// </summary>
    private static async Task<AppUser> EnsureCandidateAsync(
        ApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        const string email = "candidate@gmail.com";
        const string rawPhone = "0900000001";
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
                DisplayName = "Demo Candidate",
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
                FullName = "Demo Candidate",
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
    /// 3. Đảm bảo Affiliate (affiliate@gmail.com) tồn tại ở trạng thái APPROVED
    /// </summary>
    private static async Task<AppUser> EnsureAffiliateAsync(
        ApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        Guid adminUserId,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        const string email = "affiliate@gmail.com";
        const string rawPhone = "0900000002";
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
                DisplayName = "Demo Affiliate",
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
                DisplayName = "Demo Affiliate",
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
                DisplayName = "Demo Affiliate",
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

        // Đảm bảo gán vai trò AFFILIATE_RECRUITER
        await EnsureUserRoleAsync(context, user.UserId, "AFFILIATE_RECRUITER", "AFFILIATE_APPROVAL", adminUserId, now, logger, cancellationToken);

        return user;
    }

    /// <summary>
    /// 4. Đảm bảo Client (client@gmail.com) tồn tại ở trạng thái APPROVED kèm Company và CompanyUser
    /// </summary>
    private static async Task<AppUser> EnsureClientAsync(
        ApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        Guid adminUserId,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        const string email = "client@gmail.com";
        const string rawPhone = "0900000003";
        const string companyName = "HR Connect Demo Company";
        const string taxCode = "DEMO-TAX-001";
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
                DisplayName = "Demo Client",
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

        // Đảm bảo Company tồn tại
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

        // Đảm bảo CompanyUser liên kết Client với Company
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
            logger?.LogInformation("Linked Client {Email} to Company {CompanyName} as Primary Contact", email, companyName);
        }

        // Đảm bảo CompanyVerificationRequest ở trạng thái APPROVED
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

        // Đảm bảo gán vai trò CLIENT_COMPANY_USER
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
