using FluentAssertions;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Persistence;

public class ServiceTypeAllowedRoleSeederTests
{
    [Fact]
    public async Task SeedAsync_ShouldCorrectExistingCvSourcingCandidatePermission()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var context = new ApplicationDbContext(options);

        await DatabaseSeeder.SeedAsync(context);
        var sourcing = await context.ServiceTypes.SingleAsync(x => x.Code == "CV_SOURCING");
        var candidate = await context.Roles.SingleAsync(x => x.Code == "CANDIDATE");
        var existing = await context.ServiceTypeAllowedRoles.SingleAsync(x =>
            x.ServiceTypeId == sourcing.ServiceTypeId && x.RoleId == candidate.RoleId);
        existing.CanView = true;
        existing.CanSubmit = true;
        existing.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();

        await ServiceTypeAllowedRoleSeeder.SeedAsync(context);

        var mapping = await context.ServiceTypeAllowedRoles.SingleAsync(x =>
            x.ServiceTypeId == sourcing.ServiceTypeId && x.RoleId == candidate.RoleId);
        mapping.CanView.Should().BeFalse();
        mapping.CanSubmit.Should().BeFalse();
    }

    [Fact]
    public async Task SeedAsync_ShouldCreateExpectedMatrixAndRemainIdempotent()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var context = new ApplicationDbContext(options);

        await DatabaseSeeder.SeedAsync(context);
        await ServiceTypeAllowedRoleSeeder.SeedAsync(context);

        var mappings = await context.ServiceTypeAllowedRoles
            .Include(x => x.ServiceType).Include(x => x.Role).ToListAsync();
        mappings.Should().HaveCount(9);
        mappings.Should().ContainSingle(x => x.ServiceType.Code == "HEADHUNT_COD" &&
            x.Role.Code == "AFFILIATE_RECRUITER" && x.CanView && x.CanSubmit);
        mappings.Should().ContainSingle(x => x.ServiceType.Code == "HEADHUNT_COD" &&
            x.Role.Code == "CANDIDATE" && !x.CanView && !x.CanSubmit);
        mappings.Should().ContainSingle(x => x.ServiceType.Code == "CV_SOURCING" &&
            x.Role.Code == "CANDIDATE" && !x.CanView && !x.CanSubmit);
        mappings.Should().ContainSingle(x => x.ServiceType.Code == "CV_SOURCING" &&
            x.Role.Code == "AFFILIATE_RECRUITER" && x.CanView && x.CanSubmit);
        mappings.Should().ContainSingle(x => x.ServiceType.Code == "CV_SOURCING" &&
            x.Role.Code == "INTERNAL_HR" && x.CanView && x.CanSubmit);
        mappings.Should().ContainSingle(x => x.ServiceType.Code == "HEADHUNT_COD" &&
            x.Role.Code == "INTERNAL_HR" && x.CanView && x.CanSubmit);
    }
}
