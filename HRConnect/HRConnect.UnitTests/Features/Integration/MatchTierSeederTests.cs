using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRConnect.UnitTests.Features.Integration;

/// <summary>BUG-05 (test 20/10): AI results must get a tier from match_tier_config.</summary>
public class MatchTierSeederTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Fact]
    public async Task Seed_ShouldCreateFourTiersOnce_AndFillEarlierResults()
    {
        var now = DateTime.UtcNow;
        _context.AiMatchResults.AddRange(
            new AiMatchResult { MatchResultId = Guid.NewGuid(), ApplicationId = Guid.NewGuid(), MatchScore = 7.5m, Status = "COMPLETED", RequestedAt = now },
            new AiMatchResult { MatchResultId = Guid.NewGuid(), ApplicationId = Guid.NewGuid(), MatchScore = 85m, Status = "COMPLETED", RequestedAt = now },
            new AiMatchResult { MatchResultId = Guid.NewGuid(), ApplicationId = Guid.NewGuid(), MatchScore = 69.99m, Status = "COMPLETED", RequestedAt = now });
        _context.SaveChanges();

        await MatchTierSeeder.SeedAsync(_context);
        await MatchTierSeeder.SeedAsync(_context);

        _context.MatchTierConfigs.Should().HaveCount(4);
        _context.AiMatchResults.AsEnumerable().OrderBy(r => r.MatchScore).Select(r => r.MatchTier)
            .Should().Equal("LOW", "MEDIUM", "HIGH");
    }

    // Topic form palette: >=80 red heart, 70-79 teal, 60-69 light green, <60 grey. An Admin-picked colour stays.
    [Fact]
    public async Task Seed_ShouldMoveOldDefaultColours_ToTheTopicFormPalette_AndKeepAdminColours()
    {
        var now = DateTime.UtcNow;
        _context.MatchTierConfigs.AddRange(
            new MatchTierConfig { TierCode = "HIGH", DisplayName = "Rất phù hợp", MinScore = 80m, MaxScore = 100m, ColorCode = "#16A34A", DisplayOrder = 1, IsActive = true, CreatedAt = now, UpdatedAt = now },
            new MatchTierConfig { TierCode = "MEDIUM_HIGH", DisplayName = "Khá phù hợp", MinScore = 70m, MaxScore = 79.99m, ColorCode = "#123456", DisplayOrder = 2, IsActive = true, CreatedAt = now, UpdatedAt = now });
        _context.SaveChanges();

        await MatchTierSeeder.SeedAsync(_context);

        var colours = _context.MatchTierConfigs.AsEnumerable().ToDictionary(t => t.TierCode, t => t.ColorCode);
        colours["HIGH"].Should().Be("#E11D48");
        colours["MEDIUM_HIGH"].Should().Be("#123456");
        colours["MEDIUM"].Should().Be("#84CC16");
        colours["LOW"].Should().Be("#94A3B8");
    }
}
