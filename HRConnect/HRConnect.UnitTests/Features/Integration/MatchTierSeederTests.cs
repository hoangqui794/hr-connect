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
}
