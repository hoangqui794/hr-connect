using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
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
        // Arrange
        var connStr = "Host=localhost;Port=5432;Database=HRConnect;Username=postgres;Password=devpassword;";
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr)
            .Options;
        await using var context = new ApplicationDbContext(options);

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
}
