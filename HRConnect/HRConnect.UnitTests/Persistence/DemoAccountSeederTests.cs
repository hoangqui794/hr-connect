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
    public async Task SeedAsync_ShouldSeedAllFourDemoAccounts_WhenDbIsEmpty()
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

        // Assert - 1. Platform Admin
        var adminUser = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == "admin@gmail.com");
        adminUser.Should().NotBeNull();
        adminUser!.DisplayName.Should().Be("Platform Admin");
        adminUser.Status.Should().Be("ACTIVE");
        adminUser.EmailVerifiedAt.Should().NotBeNull();
        passwordHasher.Verify("111111Aa@", adminUser.PasswordHash).Should().BeTrue();

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

        // Assert - 2. Candidate
        var candidateUser = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == "candidate@gmail.com");
        candidateUser.Should().NotBeNull();
        candidateUser!.DisplayName.Should().Be("Demo Candidate");
        candidateUser.Phone.Should().Be("0900000001");
        candidateUser.NormalizedPhone.Should().Be("0900000001");
        candidateUser.Status.Should().Be("ACTIVE");
        candidateUser.EmailVerifiedAt.Should().NotBeNull();
        passwordHasher.Verify("111111Aa@", candidateUser.PasswordHash).Should().BeTrue();

        var candidateProfile = await context.Candidates.FirstOrDefaultAsync(c => c.UserId == candidateUser.UserId);
        candidateProfile.Should().NotBeNull();
        candidateProfile!.FullName.Should().Be("Demo Candidate");
        candidateProfile.NormalizedEmail.Should().Be("candidate@gmail.com");
        candidateProfile.NormalizedPhone.Should().Be("0900000001");
        candidateProfile.Status.Should().Be("ACTIVE");

        var candidateRole = await context.Roles.FirstAsync(r => r.Code == "CANDIDATE");
        var candidateUserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == candidateUser.UserId && ur.RoleId == candidateRole.RoleId);
        candidateUserRole.Should().NotBeNull();
        candidateUserRole!.AssignmentSource.Should().Be("REGISTRATION");
        candidateUserRole.Status.Should().Be("ACTIVE");

        // Assert - 3. Affiliate Recruiter
        var affiliateUser = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == "affiliate@gmail.com");
        affiliateUser.Should().NotBeNull();
        affiliateUser!.DisplayName.Should().Be("Demo Affiliate");
        affiliateUser.Phone.Should().Be("0900000002");
        affiliateUser.NormalizedPhone.Should().Be("0900000002");
        affiliateUser.Status.Should().Be("ACTIVE");
        affiliateUser.EmailVerifiedAt.Should().NotBeNull();
        passwordHasher.Verify("111111Aa@", affiliateUser.PasswordHash).Should().BeTrue();

        var affiliateApp = await context.AffiliateApplications.FirstOrDefaultAsync(a => a.UserId == affiliateUser.UserId);
        affiliateApp.Should().NotBeNull();
        affiliateApp!.Status.Should().Be("APPROVED");
        affiliateApp.AffiliateType.Should().Be("RECRUITER");
        affiliateApp.ReviewedBy.Should().Be(adminUser.UserId);
        affiliateApp.ReviewedAt.Should().NotBeNull();

        var affiliateProfile = await context.AffiliateProfiles.FirstOrDefaultAsync(ap => ap.UserId == affiliateUser.UserId);
        affiliateProfile.Should().NotBeNull();
        affiliateProfile!.Status.Should().Be("ACTIVE");
        affiliateProfile.VerifiedAt.Should().NotBeNull();
        affiliateProfile.DisplayName.Should().Be("Demo Affiliate");

        var affiliateRole = await context.Roles.FirstAsync(r => r.Code == "AFFILIATE_RECRUITER");
        var affiliateUserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == affiliateUser.UserId && ur.RoleId == affiliateRole.RoleId);
        affiliateUserRole.Should().NotBeNull();
        affiliateUserRole!.AssignmentSource.Should().Be("AFFILIATE_APPROVAL");
        affiliateUserRole.AssignedBy.Should().Be(adminUser.UserId);
        affiliateUserRole.Status.Should().Be("ACTIVE");

        // Assert - 4. Client Company User
        var clientUser = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == "client@gmail.com");
        clientUser.Should().NotBeNull();
        clientUser!.DisplayName.Should().Be("Demo Client");
        clientUser.Phone.Should().Be("0900000003");
        clientUser.NormalizedPhone.Should().Be("0900000003");
        clientUser.Status.Should().Be("ACTIVE");
        clientUser.EmailVerifiedAt.Should().NotBeNull();
        passwordHasher.Verify("111111Aa@", clientUser.PasswordHash).Should().BeTrue();

        var company = await context.Companies.FirstOrDefaultAsync(c => c.CompanyName == "HR Connect Demo Company");
        company.Should().NotBeNull();
        company!.TaxCode.Should().Be("DEMO-TAX-001");
        company.VerificationStatus.Should().Be("VERIFIED");
        company.VerifiedAt.Should().NotBeNull();

        var companyUser = await context.CompanyUsers.FirstOrDefaultAsync(cu => cu.CompanyId == company.CompanyId && cu.UserId == clientUser.UserId);
        companyUser.Should().NotBeNull();
        companyUser!.IsPrimaryContact.Should().BeTrue();
        companyUser.RoleInCompany.Should().Be("HR Manager");
        companyUser.Status.Should().Be("ACTIVE");

        var verificationRequest = await context.CompanyVerificationRequests.FirstOrDefaultAsync(cvr => cvr.CompanyId == company.CompanyId);
        verificationRequest.Should().NotBeNull();
        verificationRequest!.Status.Should().Be("APPROVED");
        verificationRequest.SubmittedBy.Should().Be(clientUser.UserId);
        verificationRequest.ReviewedBy.Should().Be(adminUser.UserId);
        verificationRequest.ReviewedAt.Should().NotBeNull();

        var clientRole = await context.Roles.FirstAsync(r => r.Code == "CLIENT_COMPANY_USER");
        var clientUserRole = await context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == clientUser.UserId && ur.RoleId == clientRole.RoleId);
        clientUserRole.Should().NotBeNull();
        clientUserRole!.AssignmentSource.Should().Be("COMPANY_VERIFICATION");
        clientUserRole.AssignedBy.Should().Be(adminUser.UserId);
        clientUserRole.Status.Should().Be("ACTIVE");
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

        // Assert - exactly 1 of each entity
        (await context.AppUsers.CountAsync()).Should().Be(4);
        (await context.AdminProfiles.CountAsync()).Should().Be(1);
        (await context.Candidates.CountAsync()).Should().Be(1);
        (await context.AffiliateApplications.CountAsync()).Should().Be(1);
        (await context.AffiliateProfiles.CountAsync()).Should().Be(1);
        (await context.Companies.CountAsync()).Should().Be(1);
        (await context.CompanyUsers.CountAsync()).Should().Be(1);
        (await context.CompanyVerificationRequests.CountAsync()).Should().Be(1);
        (await context.UserRoles.CountAsync()).Should().Be(4);
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
        var candidateUser = await context.AppUsers.FirstAsync(u => u.Email == "candidate@gmail.com");
        var newHashedPassword = passwordHasher.Hash("MyNewSecretPassword999@");
        candidateUser.PasswordHash = newHashedPassword;
        context.AppUsers.Update(candidateUser);
        await context.SaveChangesAsync();

        // Act - 3. Seeder runs again on next startup
        await DemoAccountSeeder.SeedAsync(context);

        // Assert - Password must remain the new updated password, not reverted to 111111Aa@
        var reloadedCandidate = await context.AppUsers.FirstAsync(u => u.Email == "candidate@gmail.com");
        reloadedCandidate.PasswordHash.Should().Be(newHashedPassword);
        passwordHasher.Verify("MyNewSecretPassword999@", reloadedCandidate.PasswordHash).Should().BeTrue();
        passwordHasher.Verify("111111Aa@", reloadedCandidate.PasswordHash).Should().BeFalse();
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
        (await context.AppUsers.CountAsync()).Should().Be(4);
        (await context.AdminProfiles.CountAsync()).Should().Be(1);
        (await context.Candidates.CountAsync()).Should().Be(1);
        (await context.AffiliateProfiles.CountAsync()).Should().Be(1);
        (await context.Companies.CountAsync()).Should().Be(1);
    }
}
