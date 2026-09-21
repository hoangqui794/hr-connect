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
    public async Task SeedAsync_ShouldSeedJobRequirementsAndSkills_WhenCalled()
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
            .ToListAsync();

        jobs.Should().ContainSingle();
        var job = jobs.Single();

        job.Title.Should().Be(CandidateTestJobSeeder.SeedJobTitle);
        job.Status.Should().Be(JobStatuses.Active);
        job.Visibility.Should().Be(JobVisibilities.Public);
        job.EmploymentType.Should().Be("FULL_TIME");
        job.Location.Should().Be("Ho Chi Minh City");
        job.SalaryMin.Should().Be(12000000m);
        job.SalaryMax.Should().Be(18000000m);
        job.CurrencyCode.Should().Be("VND");
        job.Quantity.Should().Be(2);
        job.PostedAt.Should().NotBeNull();
        job.ClosedAt.Should().BeNull();

        // Company & Creator
        job.Company.CompanyName.Should().Be("HR Connect Demo Company");
        var clientUser = await context.AppUsers.FirstOrDefaultAsync(u => u.Email == "client@gmail.com");
        clientUser.Should().NotBeNull();
        job.CreatedBy.Should().Be(clientUser!.UserId);

        // ServiceType
        var serviceType = await context.ServiceTypes.FirstOrDefaultAsync(st => st.ServiceTypeId == job.ServiceTypeId);
        serviceType.Should().NotBeNull();
        serviceType!.Code.Should().Be(CandidateTestJobSeeder.ExpectedServiceTypeCode);

        // Job Requirements: exactly 5
        job.JobRequirements.Should().HaveCount(5);
        job.JobRequirements.Should().Contain(r => r.Category == "Experience" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.25m);
        job.JobRequirements.Should().Contain(r => r.Category == "Education" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.15m);
        job.JobRequirements.Should().Contain(r => r.Category == "Backend Development" && r.RequirementType == JobRequirementTypes.MustHave && r.Weight == 0.35m);
        job.JobRequirements.Should().Contain(r => r.Category == "Communication" && r.RequirementType == JobRequirementTypes.ShouldHave && r.Weight == 0.10m);
        job.JobRequirements.Should().Contain(r => r.Category == "English" && r.RequirementType == JobRequirementTypes.ShouldHave && r.Weight == 0.15m);

        // Job Skills: exactly 5
        job.JobSkills.Should().HaveCount(5);
        job.JobSkills.Should().Contain(js => js.Skill.SkillName == "C#" && js.IsMandatory && js.Weight == 0.30m);
        job.JobSkills.Should().Contain(js => js.Skill.SkillName == "ASP.NET Core" && js.IsMandatory && js.Weight == 0.30m);
        job.JobSkills.Should().Contain(js => js.Skill.SkillName == "PostgreSQL" && !js.IsMandatory && js.Weight == 0.15m);
        job.JobSkills.Should().Contain(js => js.Skill.SkillName == "REST API" && js.IsMandatory && js.Weight == 0.15m);
        job.JobSkills.Should().Contain(js => js.Skill.SkillName == "Git" && !js.IsMandatory && js.Weight == 0.10m);
    }

    [Fact]
    public async Task SeedAsync_ShouldBeIdempotent_WhenRunMultipleTimes()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);

        // Act - Run seeder a second time
        await CandidateTestJobSeeder.SeedAsync(context);

        // Assert - exactly 1 job, 5 requirements, 5 skills
        (await context.Jobs.CountAsync()).Should().Be(1);
        (await context.JobRequirements.CountAsync()).Should().Be(5);
        (await context.JobSkills.CountAsync()).Should().Be(5);
        (await context.Skills.CountAsync()).Should().Be(5);
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
            .FirstAsync();

        // Remove one requirement and one skill
        var reqToRemove = job.JobRequirements.First();
        var skillToRemove = job.JobSkills.First();
        context.JobRequirements.Remove(reqToRemove);
        context.JobSkills.Remove(skillToRemove);
        await context.SaveChangesAsync();

        (await context.JobRequirements.CountAsync()).Should().Be(4);
        (await context.JobSkills.CountAsync()).Should().Be(4);

        // Act - re-run seeder
        await CandidateTestJobSeeder.SeedAsync(context);

        // Assert - restored to 5 requirements and 5 skills
        (await context.JobRequirements.CountAsync()).Should().Be(5);
        (await context.JobSkills.CountAsync()).Should().Be(5);
    }

    [Fact]
    public async Task SeedAsync_ShouldVerifyCandidateCanViewAndCanSubmit_ForCvApplication()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);

        // Act
        var candidateRole = await context.Roles.FirstOrDefaultAsync(r => r.Code == "CANDIDATE");
        var cvAppServiceType = await context.ServiceTypes.FirstOrDefaultAsync(st => st.Code == "CV_APPLICATION");
        var mapping = await context.ServiceTypeAllowedRoles
            .FirstOrDefaultAsync(star => star.ServiceTypeId == cvAppServiceType!.ServiceTypeId && star.RoleId == candidateRole!.RoleId);

        // Assert
        candidateRole.Should().NotBeNull();
        cvAppServiceType.Should().NotBeNull();
        mapping.Should().NotBeNull();
        mapping!.CanView.Should().BeTrue();
        mapping.CanSubmit.Should().BeTrue();
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
            var job = await context.Jobs
                .Include(j => j.JobRequirements)
                .Include(j => j.JobSkills)
                    .ThenInclude(js => js.Skill)
                .Include(j => j.Company)
                .FirstOrDefaultAsync(j => j.Title == CandidateTestJobSeeder.SeedJobTitle);

            job.Should().NotBeNull();
            job!.Status.Should().Be(JobStatuses.Active);
            job.JobRequirements.Should().HaveCount(5);
            job.JobSkills.Should().HaveCount(5);

            // Act - test idempotency on real PostgreSQL
            await CandidateTestJobSeeder.SeedAsync(context);

            var count = await context.Jobs.CountAsync(j => j.Title == CandidateTestJobSeeder.SeedJobTitle);
            count.Should().Be(1);
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
