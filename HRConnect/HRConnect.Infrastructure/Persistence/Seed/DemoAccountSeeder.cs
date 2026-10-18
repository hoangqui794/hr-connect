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
    public const string Client3Email = "client3@gmail.com";
    public const string Client4Email = "client4@gmail.com";
    public const string Client5Email = "client5@gmail.com";

    // Demo account phones
    public const string CandidatePhone = "0900000001";
    public const string AffiliatePhone = "0900000002";
    public const string ClientPhone = "0900000003";
    public const string InternalHrPhone = "0900000004";

    public const string Candidate2Phone = "0900000011";
    public const string Affiliate2Phone = "0900000012";
    public const string Client2Phone = "0900000013";
    public const string InternalHr2Phone = "0900000014";
    public const string Client3Phone = "0900000023";
    public const string Client4Phone = "0900000033";
    public const string Client5Phone = "0900000043";

    public const string DemoCompanyName = "HR Connect Demo Company";
    public const string DemoCompanyTaxCode = "DEMO-TAX-001";

    public const string DemoCompany2Name = "HR Connect Demo Company 2";
    public const string DemoCompany2TaxCode = "DEMO-TAX-002";

    public const string DemoCompany3Name = "NovaTech Solutions Vietnam";
    public const string DemoCompany3TaxCode = "DEMO-TAX-003";

    public const string DemoCompany4Name = "Mekong Fintech";
    public const string DemoCompany4TaxCode = "DEMO-TAX-004";

    public const string DemoCompany5Name = "Lotus Commerce";
    public const string DemoCompany5TaxCode = "DEMO-TAX-005";

    private static readonly IReadOnlyDictionary<string, DemoCompanyProfile> DemoCompanyProfiles =
        new Dictionary<string, DemoCompanyProfile>(StringComparer.Ordinal)
        {
            [DemoCompanyTaxCode] = new(
                "Công nghệ nhân sự và tuyển dụng",
                "51-200 nhân sự",
                "https://hrconnectvn.online",
                "Khu Công nghệ cao, Thành phố Thủ Đức, Thành phố Hồ Chí Minh",
                "HR Connect phát triển nền tảng tuyển dụng kết nối doanh nghiệp, ứng viên và mạng lưới cộng tác viên. Công ty tập trung vào trải nghiệm tuyển dụng minh bạch, quản lý hồ sơ tập trung và hỗ trợ sàng lọc ứng viên bằng công nghệ."),
            [DemoCompany2TaxCode] = new(
                "Phát triển phần mềm doanh nghiệp",
                "201-500 nhân sự",
                "https://hrconnectvn.online",
                "Quận Cầu Giấy, Hà Nội",
                "HR Connect Demo Company 2 cung cấp giải pháp phần mềm cho doanh nghiệp trong các lĩnh vực vận hành, dữ liệu và chuyển đổi số. Môi trường làm việc chú trọng phát triển chuyên môn, cộng tác liên phòng ban và lộ trình nghề nghiệp rõ ràng."),
            [DemoCompany3TaxCode] = new(
                "Giải pháp công nghệ và điện toán đám mây",
                "101-200 nhân sự",
                "https://hrconnectvn.online",
                "Quận Hải Châu, Đà Nẵng",
                "NovaTech Solutions Vietnam xây dựng sản phẩm số, nền tảng cloud và hệ thống tích hợp cho khách hàng trong nước và quốc tế. Đội ngũ kỹ thuật làm việc theo mô hình linh hoạt, đề cao chất lượng sản phẩm và tinh thần học hỏi."),
            [DemoCompany4TaxCode] = new(
                "Công nghệ tài chính",
                "51-100 nhân sự",
                "https://hrconnectvn.online",
                "Quận Ninh Kiều, Cần Thơ",
                "Mekong Fintech phát triển các giải pháp thanh toán, phân tích dữ liệu và quản trị tài chính dành cho doanh nghiệp vừa và nhỏ. Công ty ưu tiên tính an toàn, khả năng mở rộng và trải nghiệm thân thiện cho người dùng."),
            [DemoCompany5TaxCode] = new(
                "Thương mại điện tử và bán lẻ",
                "201-500 nhân sự",
                "https://hrconnectvn.online",
                "Quận 7, Thành phố Hồ Chí Minh",
                "Lotus Commerce vận hành hệ sinh thái thương mại điện tử kết nối thương hiệu Việt với người tiêu dùng trên nhiều kênh. Công ty đầu tư vào công nghệ bán lẻ, logistics và dữ liệu để tạo trải nghiệm mua sắm thuận tiện, nhất quán."),
        };

    /// <summary>
    /// Nạp các tài khoản demo/phát triển cho toàn bộ các vai trò trong hệ thống (Platform Admin, Internal HR, Candidate, Affiliate Recruiter, Client Company User),
    /// đồng thời tạo nhiều tài khoản Client/Company nhằm hỗ trợ kiểm thử đa người dùng và đa doanh nghiệp.
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

            await EnsureClientWithCompanyAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                adminUser.UserId, Client3Email, "Demo Client NovaTech", Client3Phone,
                DemoCompany3Name, DemoCompany3TaxCode, now, logger, cancellationToken);

            await EnsureClientWithCompanyAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                adminUser.UserId, Client4Email, "Demo Client Mekong Fintech", Client4Phone,
                DemoCompany4Name, DemoCompany4TaxCode, now, logger, cancellationToken);

            await EnsureClientWithCompanyAsync(
                context, passwordHasher, emailNormalizer, phoneNormalizer,
                adminUser.UserId, Client5Email, "Demo Client Lotus Commerce", Client5Phone,
                DemoCompany5Name, DemoCompany5TaxCode, now, logger, cancellationToken);

            // Demo accounts may be created after the candidate identity migration has already
            // backfilled existing users. Keep the login email and user_email_identity invariant
            // intact on every seed run, including databases that already contain demo accounts.
            var demoEmails = new[]
            {
                AdminEmail,
                InternalHrEmail,
                InternalHr2Email,
                CandidateEmail,
                Candidate2Email,
                AffiliateEmail,
                Affiliate2Email,
                ClientEmail,
                Client2Email,
                Client3Email,
                Client4Email,
                Client5Email
            };

            var demoUsers = await context.AppUsers
                .Where(user => demoEmails.Contains(user.Email))
                .ToListAsync(cancellationToken);

            foreach (var demoUser in demoUsers)
            {
                await EnsurePrimaryEmailIdentityAsync(
                    context, demoUser, emailNormalizer, now, logger, cancellationToken);
            }

            logger?.LogInformation("Demo accounts seeding completed successfully (12 accounts).");
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

        var companyProfile = DemoCompanyProfiles[taxCode];

        if (company == null)
        {
            company = new Company
            {
                CompanyId = Guid.NewGuid(),
                CompanyName = companyName,
                TaxCode = taxCode,
                Industry = companyProfile.Industry,
                CompanySize = companyProfile.CompanySize,
                Website = companyProfile.Website,
                Address = companyProfile.Address,
                Description = companyProfile.Description,
                VerificationStatus = "VERIFIED",
                VerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.Companies.AddAsync(company, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Created demo Company: {CompanyName}", companyName);
        }
        else
        {
            // Seed runs on every startup in development. Refresh the demo profile so
            // databases created by older seed versions receive the complete company data too.
            company.Industry = companyProfile.Industry;
            company.CompanySize = companyProfile.CompanySize;
            company.Website = companyProfile.Website;
            company.Address = companyProfile.Address;
            company.Description = companyProfile.Description;
            company.VerificationStatus = "VERIFIED";
            company.VerifiedAt ??= now;
            company.UpdatedAt = now;

            context.Companies.Update(company);
            await context.SaveChangesAsync(cancellationToken);
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

    private sealed record DemoCompanyProfile(
        string Industry,
        string CompanySize,
        string Website,
        string Address,
        string Description);

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
            var user = await context.AppUsers.SingleAsync(x => x.UserId == userId, cancellationToken);
            user.AuthorizationConcurrencyToken = Guid.NewGuid();
            user.UpdatedAt = now;
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Assigned role {RoleCode} to UserId {UserId} with source {Source}", roleCode, userId, assignmentSource);
        }
        else if (existingUserRole.Status != "ACTIVE")
        {
            existingUserRole.Status = "ACTIVE";
            existingUserRole.AssignmentSource = assignmentSource;
            existingUserRole.AssignedAt = now;
            existingUserRole.AssignedBy = assignedBy ?? existingUserRole.AssignedBy;
            existingUserRole.RevokedAt = null;
            existingUserRole.RevokedBy = null;
            existingUserRole.RevokeReason = null;
            var user = await context.AppUsers.SingleAsync(x => x.UserId == userId, cancellationToken);
            user.AuthorizationConcurrencyToken = Guid.NewGuid();
            user.UpdatedAt = now;
            context.UserRoles.Update(existingUserRole);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Re-activated role {RoleCode} for UserId {UserId}", roleCode, userId);
        }
    }

    /// <summary>
    /// Ensures every demo account has exactly one active PRIMARY identity matching its login email.
    /// This also repairs demo users created after the identity migration's one-time backfill.
    /// </summary>
    private static async Task EnsurePrimaryEmailIdentityAsync(
        ApplicationDbContext context,
        AppUser user,
        IEmailNormalizer emailNormalizer,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = emailNormalizer.Normalize(user.Email);
        var identityForEmail = await context.UserEmailIdentities
            .FirstOrDefaultAsync(
                identity => identity.NormalizedEmail == normalizedEmail && identity.Status != "REVOKED",
                cancellationToken);

        if (identityForEmail is not null && identityForEmail.UserId != user.UserId)
        {
            throw new InvalidOperationException(
                $"Cannot seed PRIMARY email identity for demo user {user.UserId}: " +
                $"email {normalizedEmail} is already linked to another account.");
        }

        var primaryIdentity = await context.UserEmailIdentities
            .FirstOrDefaultAsync(
                identity => identity.UserId == user.UserId &&
                            identity.Kind == "PRIMARY" &&
                            identity.Status != "REVOKED",
                cancellationToken);

        if (primaryIdentity is not null &&
            identityForEmail is not null &&
            primaryIdentity.EmailIdentityId != identityForEmail.EmailIdentityId)
        {
            throw new InvalidOperationException(
                $"Cannot seed PRIMARY email identity for demo user {user.UserId}: " +
                $"login email {normalizedEmail} is already linked as another active identity.");
        }

        if (primaryIdentity is null)
        {
            primaryIdentity = identityForEmail;
            if (primaryIdentity is null)
            {
                primaryIdentity = new UserEmailIdentity
                {
                    EmailIdentityId = Guid.NewGuid(),
                    UserId = user.UserId,
                    CreatedAt = now,
                    ConcurrencyToken = Guid.NewGuid()
                };
                await context.UserEmailIdentities.AddAsync(primaryIdentity, cancellationToken);
            }
        }

        primaryIdentity.Email = user.Email.Trim();
        primaryIdentity.NormalizedEmail = normalizedEmail;
        primaryIdentity.Kind = "PRIMARY";
        primaryIdentity.Status = user.EmailVerifiedAt.HasValue ? "VERIFIED" : "PENDING";
        primaryIdentity.VerificationSource = "DEMO_SEED";
        primaryIdentity.VerifiedAt = user.EmailVerifiedAt;
        primaryIdentity.RevokedAt = null;
        primaryIdentity.UpdatedAt = now;

        await context.SaveChangesAsync(cancellationToken);
        logger?.LogInformation(
            "Ensured PRIMARY email identity for demo account {Email} ({UserId}).",
            user.Email,
            user.UserId);
    }
}
