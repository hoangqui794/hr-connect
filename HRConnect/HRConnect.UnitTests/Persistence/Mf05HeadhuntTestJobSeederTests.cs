using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRConnect.UnitTests.Persistence;

public class Mf05HeadhuntTestJobSeederTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task SeedAsync_ShouldSeedFourHeadhuntJobsIdempotently_WithOneDayMf05Config()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        await DatabaseSeeder.SeedAsync(context, seedDemoAccounts: true);
        var baselineCount = await context.Jobs.CountAsync();

        // Act
        await Mf05HeadhuntTestJobSeeder.SeedAsync(context);
        await Mf05HeadhuntTestJobSeeder.SeedAsync(context); // Idempotent second call

        // Assert
        var totalCount = await context.Jobs.CountAsync();
        totalCount.Should().Be(baselineCount + 4);

        var seededIds = Mf05HeadhuntTestJobSeeder.SeedJobs.Select(j => j.JobId).ToArray();
        var mf05Jobs = await context.Jobs
            .Include(j => j.ServiceType)
            .Include(j => j.JobRequirements)
            .Include(j => j.JobSkills)
            .Where(j => seededIds.Contains(j.JobId))
            .ToListAsync();

        mf05Jobs.Should().HaveCount(4);
        mf05Jobs.Should().OnlyContain(job =>
            job.Status == JobStatuses.Active &&
            job.ServiceType.Code == Mf05HeadhuntTestJobSeeder.ServiceTypeCode &&
            job.WarrantyDays == 1 &&
            job.PaymentDueDays == 1 &&
            job.ProposedWarrantyDays == 1 &&
            job.ProposedPaymentDueDays == 1 &&
            job.FeeMultiplier == 1.50m &&
            job.JobRequirements.Count == 4 &&
            job.JobSkills.Count == 5 &&
            job.JobRequirements.Sum(r => r.Weight) == 1.00m &&
            job.JobSkills.Sum(s => s.Weight) == 1.00m);
    }
}
