using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using HRConnect.Infrastructure.Services.Storage;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRConnect.UnitTests.Persistence;

public class CandidateTestJobSeederTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task SeedAsync_ShouldSeedAllThreeJobsRequirementsAndSkills_WhenCalled()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();

        // Act
        await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);

        // Assert
        var jobs = await context.Jobs
            .Include(j => j.JobRequirements)
            .Include(j => j.JobSkills)
                .ThenInclude(js => js.Skill)
            .Include(j => j.Company)
            .Include(j => j.ServiceType)
            .OrderBy(j => j.Title)
            .ToListAsync();

        // Exactly 3 representative Jobs must be seeded
        jobs.Should().HaveCount(3);

        var clientUser = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == "client@gmail.com");
        clientUser.Should().NotBeNull();

        // ----------------------------------------------------------------------
        // 1. JOB 1 — CV_APPLICATION
        // ----------------------------------------------------------------------
        var job1 = jobs.FirstOrDefault(j => j.Title == CandidateTestJobSeeder.Job1Title);
        job1.Should().NotBeNull();
        job1!.ServiceType.Code.Should().Be("CV_APPLICATION");
        job1.Status.Should().Be(JobStatuses.Active);
        job1.Visibility.Should().Be(JobVisibilities.Public);
        job1.EmploymentType.Should().Be("FULL_TIME");
        job1.Location.Should().Be("Ho Chi Minh City");
        job1.SalaryMin.Should().Be(12000000m);
        job1.SalaryMax.Should().Be(18000000m);
        job1.CurrencyCode.Should().Be("VND");
        job1.Quantity.Should().Be(2);
        job1.Company.CompanyName.Should().Be("HR Connect Demo Company");
        job1.CreatedBy.Should().Be(clientUser!.UserId);
        job1.PostedAt.Should().NotBeNull();
        job1.ClosedAt.Should().BeNull();

        job1.JobRequirements.Should().HaveCount(5);
        job1.JobRequirements.Should().Contain(r => r.Category == "Experience" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.20m);
        job1.JobRequirements.Should().Contain(r => r.Category == "Technical" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.35m);
        job1.JobRequirements.Should().Contain(r => r.Category == "Database" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.15m);
        job1.JobRequirements.Should().Contain(r => r.Category == "Education" && r.RequirementType == JobRequirementTypes.ShouldHave && r.Weight == 0.15m);
        job1.JobRequirements.Should().Contain(r => r.Category == "Communication" && r.RequirementType == JobRequirementTypes.ShouldHave && r.Weight == 0.15m);

        job1.JobSkills.Should().HaveCount(5);
        job1.JobSkills.Should().Contain(js => js.Skill.SkillName == "C#" && js.IsMandatory && js.Weight == 0.30m);
        job1.JobSkills.Should().Contain(js => js.Skill.SkillName == "ASP.NET Core" && js.IsMandatory && js.Weight == 0.30m);
        job1.JobSkills.Should().Contain(js => js.Skill.SkillName == "PostgreSQL" && !js.IsMandatory && js.Weight == 0.15m);
        job1.JobSkills.Should().Contain(js => js.Skill.SkillName == "REST API" && js.IsMandatory && js.Weight == 0.15m);
        job1.JobSkills.Should().Contain(js => js.Skill.SkillName == "Git" && !js.IsMandatory && js.Weight == 0.10m);

        // ----------------------------------------------------------------------
        // 2. JOB 2 — HEADHUNT_COD
        // ----------------------------------------------------------------------
        var job2 = jobs.FirstOrDefault(j => j.Title == CandidateTestJobSeeder.Job2Title);
        job2.Should().NotBeNull();
        job2!.ServiceType.Code.Should().Be("HEADHUNT_COD");
        job2.Status.Should().Be(JobStatuses.Active);
        job2.Visibility.Should().Be(JobVisibilities.Public);
        job2.EmploymentType.Should().Be("FULL_TIME");
        job2.Location.Should().Be("Ho Chi Minh City");
        job2.SalaryMin.Should().Be(25000000m);
        job2.SalaryMax.Should().Be(40000000m);
        job2.CurrencyCode.Should().Be("VND");
        job2.Quantity.Should().Be(2);
        job2.Company.CompanyName.Should().Be("HR Connect Demo Company");
        job2.CreatedBy.Should().Be(clientUser!.UserId);
        job2.PostedAt.Should().NotBeNull();
        job2.ClosedAt.Should().BeNull();

        job2.JobRequirements.Should().HaveCount(5);
        job2.JobRequirements.Should().Contain(r => r.Category == "Experience" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.30m);
        job2.JobRequirements.Should().Contain(r => r.Category == "Technical" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.30m);
        job2.JobRequirements.Should().Contain(r => r.Category == "Database" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.15m);
        job2.JobRequirements.Should().Contain(r => r.Category == "Deployment/Engineering" && r.RequirementType == JobRequirementTypes.ShouldHave && r.Weight == 0.15m);
        job2.JobRequirements.Should().Contain(r => r.Category == "Communication" && r.RequirementType == JobRequirementTypes.ShouldHave && r.Weight == 0.10m);

        job2.JobSkills.Should().HaveCount(5);
        job2.JobSkills.Should().Contain(js => js.Skill.SkillName == "C#" && js.IsMandatory && js.Weight == 0.25m);
        job2.JobSkills.Should().Contain(js => js.Skill.SkillName == "ASP.NET Core" && js.IsMandatory && js.Weight == 0.25m);
        job2.JobSkills.Should().Contain(js => js.Skill.SkillName == "PostgreSQL" && js.IsMandatory && js.Weight == 0.20m);
        job2.JobSkills.Should().Contain(js => js.Skill.SkillName == "REST API" && js.IsMandatory && js.Weight == 0.15m);
        job2.JobSkills.Should().Contain(js => js.Skill.SkillName == "Docker" && !js.IsMandatory && js.Weight == 0.15m);

        // ----------------------------------------------------------------------
        // 3. JOB 3 — CV_SOURCING
        // ----------------------------------------------------------------------
        var job3 = jobs.FirstOrDefault(j => j.Title == CandidateTestJobSeeder.Job3Title);
        job3.Should().NotBeNull();
        job3!.ServiceType.Code.Should().Be("CV_SOURCING");
        job3.Status.Should().Be(JobStatuses.Active);
        job3.Visibility.Should().Be(JobVisibilities.Public);
        job3.EmploymentType.Should().Be("FULL_TIME");
        job3.Location.Should().Be("Ho Chi Minh City");
        job3.SalaryMin.Should().Be(18000000m);
        job3.SalaryMax.Should().Be(30000000m);
        job3.CurrencyCode.Should().Be("VND");
        job3.Quantity.Should().Be(3);
        job3.Company.CompanyName.Should().Be("HR Connect Demo Company");
        job3.CreatedBy.Should().Be(clientUser!.UserId);
        job3.PostedAt.Should().NotBeNull();
        job3.ClosedAt.Should().BeNull();

        job3.JobRequirements.Should().HaveCount(5);
        job3.JobRequirements.Should().Contain(r => r.Category == "Experience" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.20m);
        job3.JobRequirements.Should().Contain(r => r.Category == "Backend" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.25m);
        job3.JobRequirements.Should().Contain(r => r.Category == "Frontend" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.20m);
        job3.JobRequirements.Should().Contain(r => r.Category == "Database" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.15m);
        job3.JobRequirements.Should().Contain(r => r.Category == "Software Engineering" && r.RequirementType == JobRequirementTypes.ShouldHave && r.Weight == 0.20m);

        job3.JobSkills.Should().HaveCount(6);
        job3.JobSkills.Should().Contain(js => js.Skill.SkillName == "C#" && js.IsMandatory && js.Weight == 0.20m);
        job3.JobSkills.Should().Contain(js => js.Skill.SkillName == "ASP.NET Core" && js.IsMandatory && js.Weight == 0.20m);
        job3.JobSkills.Should().Contain(js => js.Skill.SkillName == "React" && !js.IsMandatory && js.Weight == 0.20m);
        job3.JobSkills.Should().Contain(js => js.Skill.SkillName == "PostgreSQL" && js.IsMandatory && js.Weight == 0.15m);
        job3.JobSkills.Should().Contain(js => js.Skill.SkillName == "REST API" && js.IsMandatory && js.Weight == 0.15m);
        job3.JobSkills.Should().Contain(js => js.Skill.SkillName == "Git" && !js.IsMandatory && js.Weight == 0.10m);
    }

    [Fact]
    public async Task SeedAsync_ShouldBeIdempotent_WhenRunMultipleTimes()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);

        // Act - Run seeder a second time
        await CandidateTestJobSeeder.SeedAsync(context);

        // Assert - exactly 3 jobs, 15 requirements (5 * 3), 16 job_skills (5 + 5 + 6)
        (await context.Jobs.CountAsync()).Should().Be(3);
        (await context.JobRequirements.CountAsync()).Should().Be(15);
        (await context.JobSkills.CountAsync()).Should().Be(16);
        (await context.Skills.CountAsync()).Should().Be(7); // C#, ASP.NET Core, PostgreSQL, REST API, Git, Docker, React
    }

    [Fact]
    public async Task SeedAsync_ShouldBackfillMissingRequirementsAndSkills()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);

        var job = await context.Jobs
            .Include(j => j.JobRequirements)
            .Include(j => j.JobSkills)
            .FirstAsync(j => j.Title == CandidateTestJobSeeder.Job1Title);

        // Remove one requirement and one skill
        var reqToRemove = job.JobRequirements.First();
        var skillToRemove = job.JobSkills.First();
        context.JobRequirements.Remove(reqToRemove);
        context.JobSkills.Remove(skillToRemove);
        await context.SaveChangesAsync();

        var job1ReqsCountBefore = await context.JobRequirements.CountAsync(r => r.JobId == job.JobId);
        var job1SkillsCountBefore = await context.JobSkills.CountAsync(s => s.JobId == job.JobId);
        job1ReqsCountBefore.Should().Be(4);
        job1SkillsCountBefore.Should().Be(4);

        // Act - re-run seeder
        await CandidateTestJobSeeder.SeedAsync(context);

        // Assert - restored to 5 requirements and 5 skills for Job 1
        var job1ReqsCountAfter = await context.JobRequirements.CountAsync(r => r.JobId == job.JobId);
        var job1SkillsCountAfter = await context.JobSkills.CountAsync(s => s.JobId == job.JobId);
        job1ReqsCountAfter.Should().Be(5);
        job1SkillsCountAfter.Should().Be(5);
    }

    [Fact]
    public async Task SeedAsync_ShouldVerifyAccessMatrixForAllServiceTypes()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);

        var candidateRole = await context.Roles.FirstOrDefaultAsync(r => r.Code == "CANDIDATE");
        var affiliateRole = await context.Roles.FirstOrDefaultAsync(r => r.Code == "AFFILIATE_RECRUITER");
        candidateRole.Should().NotBeNull();
        affiliateRole.Should().NotBeNull();

        // 1. CV_APPLICATION: CANDIDATE can_view=true, can_submit=true; AFFILIATE_RECRUITER can_view=false, can_submit=false
        var cvAppSt = await context.ServiceTypes.FirstOrDefaultAsync(st => st.Code == "CV_APPLICATION");
        cvAppSt.Should().NotBeNull();

        var cvAppCand = await context.ServiceTypeAllowedRoles
            .FirstOrDefaultAsync(star => star.ServiceTypeId == cvAppSt!.ServiceTypeId && star.RoleId == candidateRole!.RoleId);
        cvAppCand.Should().NotBeNull();
        cvAppCand!.CanView.Should().BeTrue();
        cvAppCand.CanSubmit.Should().BeTrue();

        var cvAppAff = await context.ServiceTypeAllowedRoles
            .FirstOrDefaultAsync(star => star.ServiceTypeId == cvAppSt!.ServiceTypeId && star.RoleId == affiliateRole!.RoleId);
        cvAppAff.Should().NotBeNull();
        cvAppAff!.CanView.Should().BeFalse();
        cvAppAff.CanSubmit.Should().BeFalse();

        // 2. HEADHUNT_COD: AFFILIATE_RECRUITER can_view=true, can_submit=true; CANDIDATE can_view=false, can_submit=false
        var headhuntSt = await context.ServiceTypes.FirstOrDefaultAsync(st => st.Code == "HEADHUNT_COD");
        headhuntSt.Should().NotBeNull();

        var headhuntAff = await context.ServiceTypeAllowedRoles
            .FirstOrDefaultAsync(star => star.ServiceTypeId == headhuntSt!.ServiceTypeId && star.RoleId == affiliateRole!.RoleId);
        headhuntAff.Should().NotBeNull();
        headhuntAff!.CanView.Should().BeTrue();
        headhuntAff.CanSubmit.Should().BeTrue();

        var headhuntCand = await context.ServiceTypeAllowedRoles
            .FirstOrDefaultAsync(star => star.ServiceTypeId == headhuntSt!.ServiceTypeId && star.RoleId == candidateRole!.RoleId);
        headhuntCand.Should().NotBeNull();
        headhuntCand!.CanView.Should().BeFalse();
        headhuntCand.CanSubmit.Should().BeFalse();

        // 3. CV_SOURCING: CANDIDATE can_view=true, can_submit=true AND AFFILIATE_RECRUITER can_view=true, can_submit=true
        var sourcingSt = await context.ServiceTypes.FirstOrDefaultAsync(st => st.Code == "CV_SOURCING");
        sourcingSt.Should().NotBeNull();

        var sourcingCand = await context.ServiceTypeAllowedRoles
            .FirstOrDefaultAsync(star => star.ServiceTypeId == sourcingSt!.ServiceTypeId && star.RoleId == candidateRole!.RoleId);
        sourcingCand.Should().NotBeNull();
        sourcingCand!.CanView.Should().BeTrue();
        sourcingCand.CanSubmit.Should().BeTrue();

        var sourcingAff = await context.ServiceTypeAllowedRoles
            .FirstOrDefaultAsync(star => star.ServiceTypeId == sourcingSt!.ServiceTypeId && star.RoleId == affiliateRole!.RoleId);
        sourcingAff.Should().NotBeNull();
        sourcingAff!.CanView.Should().BeTrue();
        sourcingAff.CanSubmit.Should().BeTrue();
    }

    [Fact]
    public async Task SeedAsync_WhenRunAgainstLocalPostgreSql_ShouldSucceedAndPersistData()
    {
        try
        {
            var connStr = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING")
                ?? "Host=localhost;Port=5432;Database=HRConnect;Username=postgres;Password=devpassword;";
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(connStr)
                .Options;
            await using var context = new ApplicationDbContext(options);

            if (!await context.Database.CanConnectAsync())
            {
                // Bỏ qua nếu môi trường (ví dụ GitHub Actions) không có dịch vụ PostgreSQL cục bộ
                return;
            }

            // Act - run seeder against local PostgreSQL
            await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);

            // Assert
            var seededJobs = await context.Jobs
                .Include(j => j.JobRequirements)
                .Include(j => j.JobSkills)
                    .ThenInclude(js => js.Skill)
                .Include(j => j.Company)
                .Where(j => CandidateTestJobSeeder.AllSeedJobTitles.Contains(j.Title))
                .ToListAsync();

            seededJobs.Should().HaveCount(3);
            seededJobs.Should().OnlyContain(j => j.Status == JobStatuses.Active);

            // Act - test idempotency on real PostgreSQL
            await CandidateTestJobSeeder.SeedAsync(context);

            var count = await context.Jobs.CountAsync(j => CandidateTestJobSeeder.AllSeedJobTitles.Contains(j.Title));
            count.Should().Be(3);
        }
        catch (Exception ex) when (ex is Npgsql.NpgsqlException || ex is System.Net.Sockets.SocketException || ex is InvalidOperationException)
        {
            // Bỏ qua ngoại lệ không kết nối được PostgreSQL trên runner CI/CD
            return;
        }
    }

    [Fact]
    public async Task CloudflareR2_LiveUploadAndCleanup_ShouldSucceed()
    {
        var possiblePaths = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), "HRConnect", ".env"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "HRConnect", ".env"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "HRConnect", ".env"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "..", "HRConnect", ".env"),
            @"D:\Ki_9\HRConnect\HRConnect\.env"
        };

        string? accessKey = null;
        string? secretKey = null;

        foreach (var path in possiblePaths)
        {
            if (File.Exists(path))
            {
                foreach (var line in File.ReadAllLines(path))
                {
                    var trimmed = line.Trim();
                    if (trimmed.StartsWith("R2_ACCESS_KEY_ID=", StringComparison.OrdinalIgnoreCase))
                        accessKey = trimmed["R2_ACCESS_KEY_ID=".Length..].Trim();
                    if (trimmed.StartsWith("R2_SECRET_ACCESS_KEY=", StringComparison.OrdinalIgnoreCase))
                        secretKey = trimmed["R2_SECRET_ACCESS_KEY=".Length..].Trim();
                }
                if (!string.IsNullOrWhiteSpace(accessKey) && !string.IsNullOrWhiteSpace(secretKey))
                    break;
            }
        }

        if (string.IsNullOrWhiteSpace(accessKey) || string.IsNullOrWhiteSpace(secretKey))
        {
            // Bỏ qua nếu môi trường (CI/CD) không cấu hình credentials R2 thực tế
            return;
        }

        var s3Config = new Amazon.S3.AmazonS3Config
        {
            ServiceURL = "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com",
            ForcePathStyle = true
        };
        var credentials = new Amazon.Runtime.BasicAWSCredentials(accessKey, secretKey);
        using var s3Client = new Amazon.S3.AmazonS3Client(credentials, s3Config);

        var settings = new R2Settings
        {
            AccountId = "ea997660e8c1f6c92b939eb22891843c",
            BucketName = "hrconnect-candidate-cvs",
            Endpoint = "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com",
            AccessKeyId = accessKey,
            SecretAccessKey = secretKey
        };

        var service = new CloudflareR2StorageService(
            s3Client,
            Microsoft.Extensions.Options.Options.Create(settings),
            Moq.Mock.Of<Microsoft.Extensions.Logging.ILogger<CloudflareR2StorageService>>());

        var testKey = $"test-connectivity/{Guid.NewGuid()}.pdf";
        using var stream = new System.IO.MemoryStream(System.Text.Encoding.UTF8.GetBytes("%PDF-1.4 connectivity test"));

        // 1. Upload
        var uploadedKey = await service.UploadAsync(stream, testKey, "application/pdf");
        uploadedKey.Should().Be(testKey);

        // 2. Exists
        var exists = await service.ExistsAsync(testKey);
        exists.Should().BeTrue();

        // 3. Presigned URL
        var presignedUrl = await service.GetPresignedDownloadUrlAsync(testKey, TimeSpan.FromMinutes(5));
        presignedUrl.Should().NotBeNullOrWhiteSpace();
        presignedUrl.Should().Contain("hrconnect-candidate-cvs");

        // 4. Cleanup / Delete
        await service.DeleteAsync(testKey);
        var existsAfterDelete = await service.ExistsAsync(testKey);
        existsAfterDelete.Should().BeFalse();
    }
}
