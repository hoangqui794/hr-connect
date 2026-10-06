using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using HRConnect.Infrastructure.Services.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Persistence;

public class DemoAccountSeederTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static async Task SeedDefaultRolesAsync(ApplicationDbContext context)
    {
        var roles = new[]
        {
            ("PLATFORM_ADMIN", "Platform Admin"),
            ("CANDIDATE", "Candidate"),
            ("AFFILIATE_RECRUITER", "Affiliate Recruiter"),
            ("CLIENT_COMPANY_USER", "Client Company User"),
            ("INTERNAL_HR", "Internal HR")
        };

        var now = DateTime.UtcNow;
        foreach (var (code, name) in roles)
        {
            if (!await context.Roles.AnyAsync(r => r.Code == code))
            {
                await context.Roles.AddAsync(new Role
                {
                    RoleId = Guid.NewGuid(),
                    Code = code,
                    Name = name,
                    IsSystem = true,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
        }

        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task SeedAsync_ShouldSeedAllNineDemoAccounts_WhenDbIsEmpty()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await SeedDefaultRolesAsync(context);

        var passwordHasher = new PasswordHasher();
        var emailNormalizer = new EmailNormalizer();
        var phoneNormalizer = new PhoneNormalizer();
        var loggerMock = new Mock<ILogger>();

        // Act
        await DemoAccountSeeder.SeedAsync(context, passwordHasher, emailNormalizer, phoneNormalizer, loggerMock.Object);

        // Assert - 1. Platform Admin (admin@gmail.com)
        var adminUser = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == DemoAccountSeeder.AdminEmail);
        adminUser.Should().NotBeNull();
        adminUser!.DisplayName.Should().Be("Platform Admin");
        adminUser.Status.Should().Be("ACTIVE");
        adminUser.EmailVerifiedAt.Should().NotBeNull();
        passwordHasher.Verify(DemoAccountSeeder.InitialDemoPassword, adminUser.PasswordHash).Should().BeTrue();

        var adminProfile = await context.AdminProfiles.FirstOrDefaultAsync(ap => ap.UserId == adminUser.UserId);
        adminProfile.Should().NotBeNull();
        adminProfile!.EmployeeCode.Should().Be("ADM001");
        adminProfile.JobTitle.Should().Be("Platform Administrator");
        adminProfile.Status.Should().Be("ACTIVE");

        var adminRole = await context.Roles.FirstAsync(r => r.Code == "PLATFORM_ADMIN");
        var adminUserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == adminUser.UserId && ur.RoleId == adminRole.RoleId);
        adminUserRole.Should().NotBeNull();
        adminUserRole!.AssignmentSource.Should().Be("ADMIN_PROVISIONING");
        adminUserRole.Status.Should().Be("ACTIVE");

        // Assert - 2. Internal HR 1 (internalhr@gmail.com) & Internal HR 2 (internalhr2@gmail.com)
        var hrRole = await context.Roles.FirstAsync(r => r.Code == "INTERNAL_HR");

        var hr1User = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == DemoAccountSeeder.InternalHrEmail);
        hr1User.Should().NotBeNull();
        hr1User!.DisplayName.Should().Be("Demo Internal HR");
        hr1User.Phone.Should().Be(DemoAccountSeeder.InternalHrPhone);
        hr1User.Status.Should().Be("ACTIVE");
        hr1User.EmailVerifiedAt.Should().NotBeNull();

        var hr1Profile = await context.InternalHrProfiles.FirstOrDefaultAsync(p => p.UserId == hr1User.UserId);
        hr1Profile.Should().NotBeNull();
        hr1Profile!.EmployeeCode.Should().Be("HR001");
        hr1Profile.JobTitle.Should().Be("Internal Recruiter");
        hr1Profile.Department.Should().Be("Recruitment");
        hr1Profile.Status.Should().Be("ACTIVE");

        var hr1UserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == hr1User.UserId && ur.RoleId == hrRole.RoleId);
        hr1UserRole.Should().NotBeNull();
        hr1UserRole!.AssignmentSource.Should().Be("ADMIN_PROVISIONING");
        hr1UserRole.AssignedBy.Should().Be(adminUser.UserId);
        hr1UserRole.Status.Should().Be("ACTIVE");

        var hr2User = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == DemoAccountSeeder.InternalHr2Email);
        hr2User.Should().NotBeNull();
        hr2User!.DisplayName.Should().Be("Demo Internal HR 2");
        hr2User.Phone.Should().Be(DemoAccountSeeder.InternalHr2Phone);
        hr2User.Status.Should().Be("ACTIVE");
        hr2User.EmailVerifiedAt.Should().NotBeNull();

        var hr2Profile = await context.InternalHrProfiles.FirstOrDefaultAsync(p => p.UserId == hr2User.UserId);
        hr2Profile.Should().NotBeNull();
        hr2Profile!.EmployeeCode.Should().Be("HR002");
        hr2Profile.JobTitle.Should().Be("Internal Recruiter");
        hr2Profile.Department.Should().Be("Recruitment");
        hr2Profile.Status.Should().Be("ACTIVE");

        var hr2UserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == hr2User.UserId && ur.RoleId == hrRole.RoleId);
        hr2UserRole.Should().NotBeNull();
        hr2UserRole!.AssignmentSource.Should().Be("ADMIN_PROVISIONING");
        hr2UserRole.AssignedBy.Should().Be(adminUser.UserId);
        hr2UserRole.Status.Should().Be("ACTIVE");

        // Assert - 3. Candidate 1 (candidate@gmail.com) & Candidate 2 (candidate2@gmail.com)
        var candidateRole = await context.Roles.FirstAsync(r => r.Code == "CANDIDATE");

        var cand1User = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == DemoAccountSeeder.CandidateEmail);
        cand1User.Should().NotBeNull();
        cand1User!.DisplayName.Should().Be("Demo Candidate");
        cand1User.Phone.Should().Be(DemoAccountSeeder.CandidatePhone);
        cand1User.Status.Should().Be("ACTIVE");
        cand1User.EmailVerifiedAt.Should().NotBeNull();

        var cand1Profile = await context.Candidates.FirstOrDefaultAsync(c => c.UserId == cand1User.UserId);
        cand1Profile.Should().NotBeNull();
        cand1Profile!.FullName.Should().Be("Demo Candidate");
        cand1Profile.NormalizedEmail.Should().Be(DemoAccountSeeder.CandidateEmail);
        cand1Profile.NormalizedPhone.Should().Be(DemoAccountSeeder.CandidatePhone);
        cand1Profile.Status.Should().Be("ACTIVE");

        var cand1UserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == cand1User.UserId && ur.RoleId == candidateRole.RoleId);
        cand1UserRole.Should().NotBeNull();
        cand1UserRole!.AssignmentSource.Should().Be("REGISTRATION");
        cand1UserRole.Status.Should().Be("ACTIVE");

        var cand2User = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == DemoAccountSeeder.Candidate2Email);
        cand2User.Should().NotBeNull();
        cand2User!.DisplayName.Should().Be("Demo Candidate 2");
        cand2User.Phone.Should().Be(DemoAccountSeeder.Candidate2Phone);
        cand2User.Status.Should().Be("ACTIVE");
        cand2User.EmailVerifiedAt.Should().NotBeNull();

        var cand2Profile = await context.Candidates.FirstOrDefaultAsync(c => c.UserId == cand2User.UserId);
        cand2Profile.Should().NotBeNull();
        cand2Profile!.FullName.Should().Be("Demo Candidate 2");
        cand2Profile.NormalizedEmail.Should().Be(DemoAccountSeeder.Candidate2Email);
        cand2Profile.NormalizedPhone.Should().Be(DemoAccountSeeder.Candidate2Phone);
        cand2Profile.Status.Should().Be("ACTIVE");

        var cand2UserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == cand2User.UserId && ur.RoleId == candidateRole.RoleId);
        cand2UserRole.Should().NotBeNull();
        cand2UserRole!.AssignmentSource.Should().Be("REGISTRATION");
        cand2UserRole.Status.Should().Be("ACTIVE");

        // Assert - 4. Affiliate Recruiter 1 (affiliate@gmail.com) & Affiliate Recruiter 2 (affiliate2@gmail.com)
        var affiliateRole = await context.Roles.FirstAsync(r => r.Code == "AFFILIATE_RECRUITER");

        var aff1User = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == DemoAccountSeeder.AffiliateEmail);
        aff1User.Should().NotBeNull();
        aff1User!.DisplayName.Should().Be("Demo Affiliate");
        aff1User.Phone.Should().Be(DemoAccountSeeder.AffiliatePhone);
        aff1User.Status.Should().Be("ACTIVE");
        aff1User.EmailVerifiedAt.Should().NotBeNull();

        var aff1App = await context.AffiliateApplications.FirstOrDefaultAsync(a => a.UserId == aff1User.UserId);
        aff1App.Should().NotBeNull();
        aff1App!.Status.Should().Be("APPROVED");
        aff1App.ReviewedBy.Should().Be(adminUser.UserId);

        var aff1Profile = await context.AffiliateProfiles.FirstOrDefaultAsync(ap => ap.UserId == aff1User.UserId);
        aff1Profile.Should().NotBeNull();
        aff1Profile!.DisplayName.Should().Be("Demo Affiliate");
        aff1Profile.Status.Should().Be("ACTIVE");

        var aff1UserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == aff1User.UserId && ur.RoleId == affiliateRole.RoleId);
        aff1UserRole.Should().NotBeNull();
        aff1UserRole!.AssignmentSource.Should().Be("AFFILIATE_APPROVAL");
        aff1UserRole.AssignedBy.Should().Be(adminUser.UserId);

        var aff2User = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == DemoAccountSeeder.Affiliate2Email);
        aff2User.Should().NotBeNull();
        aff2User!.DisplayName.Should().Be("Demo Affiliate 2");
        aff2User.Phone.Should().Be(DemoAccountSeeder.Affiliate2Phone);
        aff2User.Status.Should().Be("ACTIVE");
        aff2User.EmailVerifiedAt.Should().NotBeNull();

        var aff2App = await context.AffiliateApplications.FirstOrDefaultAsync(a => a.UserId == aff2User.UserId);
        aff2App.Should().NotBeNull();
        aff2App!.Status.Should().Be("APPROVED");
        aff2App.ReviewedBy.Should().Be(adminUser.UserId);

        var aff2Profile = await context.AffiliateProfiles.FirstOrDefaultAsync(ap => ap.UserId == aff2User.UserId);
        aff2Profile.Should().NotBeNull();
        aff2Profile!.DisplayName.Should().Be("Demo Affiliate 2");
        aff2Profile.Status.Should().Be("ACTIVE");

        var aff2UserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == aff2User.UserId && ur.RoleId == affiliateRole.RoleId);
        aff2UserRole.Should().NotBeNull();
        aff2UserRole!.AssignmentSource.Should().Be("AFFILIATE_APPROVAL");
        aff2UserRole.AssignedBy.Should().Be(adminUser.UserId);

        // Assert - 5. Client 1 (client@gmail.com - Company 1) & Client 2 (client2@gmail.com - Company 2)
        var clientRole = await context.Roles.FirstAsync(r => r.Code == "CLIENT_COMPANY_USER");

        // Client 1
        var company1 = await context.Companies.FirstOrDefaultAsync(c => c.CompanyName == DemoAccountSeeder.DemoCompanyName);
        company1.Should().NotBeNull();
        company1!.TaxCode.Should().Be(DemoAccountSeeder.DemoCompanyTaxCode);
        company1.VerificationStatus.Should().Be("VERIFIED");

        var client1User = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == DemoAccountSeeder.ClientEmail);
        client1User.Should().NotBeNull();
        client1User!.DisplayName.Should().Be("Demo Client");
        client1User.Phone.Should().Be(DemoAccountSeeder.ClientPhone);

        var companyUser1 = await context.CompanyUsers.FirstOrDefaultAsync(cu => cu.CompanyId == company1.CompanyId && cu.UserId == client1User.UserId);
        companyUser1.Should().NotBeNull();
        companyUser1!.RoleInCompany.Should().Be("HR Manager");
        companyUser1.Status.Should().Be("ACTIVE");

        var client1UserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == client1User.UserId && ur.RoleId == clientRole.RoleId);
        client1UserRole.Should().NotBeNull();
        client1UserRole!.AssignmentSource.Should().Be("COMPANY_VERIFICATION");

        var verificationRequest1 = await context.CompanyVerificationRequests.FirstOrDefaultAsync(cvr => cvr.CompanyId == company1.CompanyId);
        verificationRequest1.Should().NotBeNull();
        verificationRequest1!.Status.Should().Be("APPROVED");
        verificationRequest1.ReviewedBy.Should().Be(adminUser.UserId);

        // Client 2
        var company2 = await context.Companies.FirstOrDefaultAsync(c => c.CompanyName == DemoAccountSeeder.DemoCompany2Name);
        company2.Should().NotBeNull();
        company2!.TaxCode.Should().Be(DemoAccountSeeder.DemoCompany2TaxCode);
        company2.VerificationStatus.Should().Be("VERIFIED");

        var client2User = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == DemoAccountSeeder.Client2Email);
        client2User.Should().NotBeNull();
        client2User!.DisplayName.Should().Be("Demo Client 2");
        client2User.Phone.Should().Be(DemoAccountSeeder.Client2Phone);

        var companyUser2 = await context.CompanyUsers.FirstOrDefaultAsync(cu => cu.CompanyId == company2.CompanyId && cu.UserId == client2User.UserId);
        companyUser2.Should().NotBeNull();
        companyUser2!.RoleInCompany.Should().Be("HR Manager");
        companyUser2.Status.Should().Be("ACTIVE");

        var client2UserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == client2User.UserId && ur.RoleId == clientRole.RoleId);
        client2UserRole.Should().NotBeNull();
        client2UserRole!.AssignmentSource.Should().Be("COMPANY_VERIFICATION");

        var verificationRequest2 = await context.CompanyVerificationRequests.FirstOrDefaultAsync(cvr => cvr.CompanyId == company2.CompanyId);
        verificationRequest2.Should().NotBeNull();
        verificationRequest2!.Status.Should().Be("APPROVED");
        verificationRequest2.ReviewedBy.Should().Be(adminUser.UserId);
    }

    [Fact]
    public async Task SeedAsync_ShouldBeIdempotent_WhenExecutedMultipleTimes()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await SeedDefaultRolesAsync(context);

        // Act - Run twice
        await DemoAccountSeeder.SeedAsync(context);
        await DemoAccountSeeder.SeedAsync(context);

        // Assert - exact counts for all entities (9 accounts total)
        (await context.AppUsers.CountAsync()).Should().Be(9);
        (await context.AdminProfiles.CountAsync()).Should().Be(1);
        (await context.InternalHrProfiles.CountAsync()).Should().Be(2);
        (await context.Candidates.CountAsync()).Should().Be(2);
        (await context.AffiliateApplications.CountAsync()).Should().Be(2);
        (await context.AffiliateProfiles.CountAsync()).Should().Be(2);
        (await context.Companies.CountAsync()).Should().Be(2);
        (await context.CompanyUsers.CountAsync()).Should().Be(2);
        (await context.CompanyVerificationRequests.CountAsync()).Should().Be(2);
        (await context.UserRoles.CountAsync()).Should().Be(9);
    }

    [Fact]
    public async Task SeedAsync_ShouldNotOverwriteExistingPassword_WhenUserAlreadyExists()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await SeedDefaultRolesAsync(context);
        var passwordHasher = new PasswordHasher();

        // 1. First run seeds candidate with 111111Aa@
        await DemoAccountSeeder.SeedAsync(context);

        // 2. User changes password
        var candidateUser = await context.AppUsers.FirstAsync(u => u.Email == DemoAccountSeeder.CandidateEmail);
        var newHashedPassword = passwordHasher.Hash("MyNewSecretPassword999@");
        candidateUser.PasswordHash = newHashedPassword;
        context.AppUsers.Update(candidateUser);
        await context.SaveChangesAsync();

        // Act - 3. Seeder runs again on next startup
        await DemoAccountSeeder.SeedAsync(context);

        // Assert - Password must remain the new updated password, not reverted to 111111Aa@
        var reloadedCandidate = await context.AppUsers.FirstAsync(u => u.Email == DemoAccountSeeder.CandidateEmail);
        reloadedCandidate.PasswordHash.Should().Be(newHashedPassword);
        passwordHasher.Verify("MyNewSecretPassword999@", reloadedCandidate.PasswordHash).Should().BeTrue();
        passwordHasher.Verify(DemoAccountSeeder.InitialDemoPassword, reloadedCandidate.PasswordHash).Should().BeFalse();
    }

    [Fact]
    public async Task DatabaseSeeder_SeedAsync_ShouldSeedDemoAccounts_WhenFlagIsTrue()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();

        // Act
        await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);

        // Assert
        (await context.Roles.CountAsync()).Should().Be(5);
        (await context.AppUsers.CountAsync()).Should().Be(9);
        (await context.AdminProfiles.CountAsync()).Should().Be(1);
        (await context.InternalHrProfiles.CountAsync()).Should().Be(2);
        (await context.Candidates.CountAsync()).Should().Be(2);
        (await context.AffiliateProfiles.CountAsync()).Should().Be(2);
        (await context.Companies.CountAsync()).Should().Be(2);
        (await context.CompanyUsers.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task SeedAsync_ShouldSupportMultiUserScenarios_DistinctCandidateAndAffiliateProfiles()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await SeedDefaultRolesAsync(context);

        // Act
        await DemoAccountSeeder.SeedAsync(context);

        // Assert - Distinct Candidates
        var cand1 = await context.Candidates.FirstAsync(c => c.NormalizedEmail == DemoAccountSeeder.CandidateEmail);
        var cand2 = await context.Candidates.FirstAsync(c => c.NormalizedEmail == DemoAccountSeeder.Candidate2Email);
        cand1.CandidateId.Should().NotBe(cand2.CandidateId);
        cand1.UserId.Should().NotBeNull();
        cand2.UserId.Should().NotBeNull();
        cand1.UserId!.Value.Should().NotBe(cand2.UserId!.Value);

        // Assert - Distinct Affiliates
        var aff1User = await context.AppUsers.FirstAsync(u => u.Email == DemoAccountSeeder.AffiliateEmail);
        var aff2User = await context.AppUsers.FirstAsync(u => u.Email == DemoAccountSeeder.Affiliate2Email);
        var aff1 = await context.AffiliateProfiles.FirstAsync(ap => ap.UserId == aff1User.UserId);
        var aff2 = await context.AffiliateProfiles.FirstAsync(ap => ap.UserId == aff2User.UserId);
        aff1.AffiliateId.Should().NotBe(aff2.AffiliateId);
        aff1.UserId.Should().NotBe(aff2.UserId);

        // Assert - Distinct Client Companies (Cross-company multi-tenant testing)
        var company1 = await context.Companies.FirstAsync(c => c.CompanyName == DemoAccountSeeder.DemoCompanyName);
        var company2 = await context.Companies.FirstAsync(c => c.CompanyName == DemoAccountSeeder.DemoCompany2Name);
        company1.CompanyId.Should().NotBe(company2.CompanyId);

        var cu1 = await context.CompanyUsers.FirstAsync(cu => cu.CompanyId == company1.CompanyId);
        var cu2 = await context.CompanyUsers.FirstAsync(cu => cu.CompanyId == company2.CompanyId);
        cu1.UserId.Should().NotBe(cu2.UserId);
    }

    [Fact]
    public async Task SeedAsync_ShouldAllowLoginForEveryDemoAccount_WithExpectedRoles()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await SeedDefaultRolesAsync(context);
        await DemoAccountSeeder.SeedAsync(context);

        var userRepository = new HRConnect.Infrastructure.Repositories.UserRepository(context);
        var refreshTokenRepository = new HRConnect.Infrastructure.Repositories.RefreshTokenRepository(context);
        var unitOfWork = new HRConnect.Infrastructure.Repositories.UnitOfWork(context);
        var passwordHasher = new PasswordHasher();
        var emailNormalizer = new EmailNormalizer();
        var otpServiceMock = new Mock<HRConnect.Application.Common.Interfaces.IOtpService>();
        otpServiceMock.Setup(x => x.HashOtp(Moq.It.IsAny<string>())).Returns((string s) => "hash_" + s);
        var loggerMock = new Mock<ILogger<HRConnect.Application.Features.Auth.Commands.Login.LoginCommandHandler>>();

        var jwtOptions = Microsoft.Extensions.Options.Options.Create(new HRConnect.Application.Common.Models.JwtSettings
        {
            Secret = "SuperSecretKeyForTestingJwtTokens123456!",
            Issuer = "HRConnect",
            Audience = "HRConnectApp",
            ExpiryMinutes = 60,
            RefreshTokenExpiryDays = 7
        });
        var jwtGenerator = new JwtTokenGenerator(jwtOptions);

        var handler = new HRConnect.Application.Features.Auth.Commands.Login.LoginCommandHandler(
            userRepository,
            refreshTokenRepository,
            passwordHasher,
            jwtGenerator,
            emailNormalizer,
            otpServiceMock.Object,
            unitOfWork,
            jwtOptions,
            loggerMock.Object);

        var testAccounts = new[]
        {
            (DemoAccountSeeder.AdminEmail, "PLATFORM_ADMIN"),
            (DemoAccountSeeder.InternalHrEmail, "INTERNAL_HR"),
            (DemoAccountSeeder.InternalHr2Email, "INTERNAL_HR"),
            (DemoAccountSeeder.CandidateEmail, "CANDIDATE"),
            (DemoAccountSeeder.Candidate2Email, "CANDIDATE"),
            (DemoAccountSeeder.AffiliateEmail, "AFFILIATE_RECRUITER"),
            (DemoAccountSeeder.Affiliate2Email, "AFFILIATE_RECRUITER"),
            (DemoAccountSeeder.ClientEmail, "CLIENT_COMPANY_USER"),
            (DemoAccountSeeder.Client2Email, "CLIENT_COMPANY_USER")
        };

        foreach (var (email, expectedRole) in testAccounts)
        {
            var command = new HRConnect.Application.Features.Auth.Commands.Login.LoginCommand(email, DemoAccountSeeder.InitialDemoPassword);
            var response = await handler.Handle(command, System.Threading.CancellationToken.None);

            response.Should().NotBeNull();
            response.Data.Should().NotBeNull();
            response.Data!.AccessToken.Should().NotBeNullOrWhiteSpace();
            response.Data.User.Roles.Should().Contain(expectedRole);
        }
    }

    [Fact]
    public async Task SeedAsync_WhenRunAgainstLocalPostgreSql_ShouldSucceedAndPersistData()
    {
        var connectionString = "Host=localhost;Port=5432;Database=hr_connect;Username=postgres;Password=postgres";
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        try
        {
            using var context = new ApplicationDbContext(options);
            if (!await context.Database.CanConnectAsync())
            {
                return; // Skip if local PostgreSQL is not running in the current test environment
            }

            // Act - Run full DatabaseSeeder with demo accounts
            await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);

            // Assert - check all 9 accounts exist in real DB
            var allDemoEmails = new[]
            {
                DemoAccountSeeder.AdminEmail,
                DemoAccountSeeder.InternalHrEmail,
                DemoAccountSeeder.InternalHr2Email,
                DemoAccountSeeder.CandidateEmail,
                DemoAccountSeeder.Candidate2Email,
                DemoAccountSeeder.AffiliateEmail,
                DemoAccountSeeder.Affiliate2Email,
                DemoAccountSeeder.ClientEmail,
                DemoAccountSeeder.Client2Email
            };

            var seededUsers = await context.AppUsers
                .Where(u => allDemoEmails.Contains(u.Email))
                .ToListAsync();

            seededUsers.Should().HaveCount(9);
            seededUsers.Should().OnlyContain(u => u.Status == "ACTIVE");

            // Check Profiles
            (await context.AdminProfiles.CountAsync(ap => ap.EmployeeCode == "ADM001")).Should().Be(1);
            (await context.InternalHrProfiles.CountAsync(p => p.EmployeeCode == "HR001" || p.EmployeeCode == "HR002")).Should().Be(2);
            (await context.Candidates.CountAsync(c => c.Email == DemoAccountSeeder.CandidateEmail || c.Email == DemoAccountSeeder.Candidate2Email)).Should().Be(2);
            (await context.AffiliateProfiles.CountAsync(ap => ap.DisplayName == "Demo Affiliate" || ap.DisplayName == "Demo Affiliate 2")).Should().Be(2);
            (await context.Companies.CountAsync(c => c.TaxCode == DemoAccountSeeder.DemoCompanyTaxCode || c.TaxCode == DemoAccountSeeder.DemoCompany2TaxCode)).Should().Be(2);

            // Act - Idempotency check on real PostgreSQL
            await DemoAccountSeeder.SeedAsync(context);

            var countAfter = await context.AppUsers
                .CountAsync(u => allDemoEmails.Contains(u.Email));
            countAfter.Should().Be(9);
        }
        catch (Exception ex) when (ex is Npgsql.NpgsqlException || ex is System.Net.Sockets.SocketException || ex is InvalidOperationException)
        {
            // Gracefully ignore connection failure if DB is unavailable
        }
    }
}


