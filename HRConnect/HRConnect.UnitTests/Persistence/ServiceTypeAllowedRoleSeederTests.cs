using FluentAssertions;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Persistence;

public class ServiceTypeAllowedRoleSeederTests
{
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
        mappings.Should().HaveCount(6);
        mappings.Should().ContainSingle(x => x.ServiceType.Code == "HEADHUNT_COD" &&
            x.Role.Code == "AFFILIATE_RECRUITER" && x.CanView && x.CanSubmit);
        mappings.Should().ContainSingle(x => x.ServiceType.Code == "HEADHUNT_COD" &&
            x.Role.Code == "CANDIDATE" && !x.CanView && !x.CanSubmit);
        mappings.Where(x => x.ServiceType.Code == "CV_SOURCING").Should().OnlyContain(x => x.CanView && x.CanSubmit);
    }
}
