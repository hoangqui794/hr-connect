using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Persistence;

public class CommissionMilestoneSeederTests
{
    private static ApplicationDbContext CreateContext() => new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task SeedAsync_InsertsTheFourExpectedMilestones_WhenTheyAreMissing()
    {
        await using var context = CreateContext();

        await CommissionMilestoneSeeder.SeedAsync(context);

        var milestones = await context.CommissionMilestones.ToListAsync();
        milestones.Select(milestone => milestone.MilestoneCode).Should().BeEquivalentTo(new[]
        {
            "APPLICATION_CREATED",
            "START_WORK",
            "PROBATION_PASSED",
            "WARRANTY_PASSED"
        });
        milestones.Should().OnlyContain(milestone => milestone.IsActive);
        milestones.Should().OnlyContain(milestone => milestone.CreatedAt != default && milestone.UpdatedAt != default);
    }

    [Fact]
    public async Task SeedAsync_DoesNotOverwriteAnExistingAdministratorEdit()
    {
        await using var context = CreateContext();
        await CommissionMilestoneSeeder.SeedAsync(context);

        var existing = await context.CommissionMilestones.SingleAsync(milestone => milestone.MilestoneCode == "PROBATION_PASSED");
        existing.Name = "Custom probation milestone";
        existing.IsActive = false;
        await context.SaveChangesAsync();

        await CommissionMilestoneSeeder.SeedAsync(context);

        var milestone = await context.CommissionMilestones.SingleAsync(item => item.MilestoneCode == "PROBATION_PASSED");
        milestone.Name.Should().Be("Custom probation milestone");
        milestone.IsActive.Should().BeFalse();
        (await context.CommissionMilestones.CountAsync()).Should().Be(4);
    }

    [Fact]
    public async Task DatabaseSeeder_SeedsCommissionMilestonesAtStartup()
    {
        await using var context = CreateContext();

        await DatabaseSeeder.SeedAsync(context);

        (await context.CommissionMilestones.CountAsync()).Should().Be(4);
    }
}
