using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

/// <summary>
/// BUG-05 (test 20/10): match_tier_config was never seeded, so every AI result had match_tier = null.
/// Seeds the 4 tiers from main-flows (≥80, 70–79, 60–69, &lt;60) by code only when missing (Admin edits survive),
/// then fills the tier of earlier AI results that have a score but no tier.
/// </summary>
public static class MatchTierSeeder
{
    public static readonly (string Code, string Name, decimal Min, decimal Max, string Color, int Order)[] Tiers =
    [
        // Topic form: >=80 red heart, 70-79 teal, 60-69 light green, <60 grey.
        ("HIGH", "Rất phù hợp", 80m, 100m, "#E11D48", 1),
        ("MEDIUM_HIGH", "Khá phù hợp", 70m, 79.99m, "#0D9488", 2),
        ("MEDIUM", "Phù hợp một phần", 60m, 69.99m, "#84CC16", 3),
        ("LOW", "Ít phù hợp", 0m, 59.99m, "#94A3B8", 4),
    ];

    /// <summary>Colours this seeder used before the topic-form palette; rows still on them are recoloured.</summary>
    private static readonly Dictionary<string, string> OldDefaultColors = new()
    {
        ["HIGH"] = "#16A34A",
        ["MEDIUM_HIGH"] = "#0EA5E9",
        ["MEDIUM"] = "#F59E0B",
    };

    public static async Task SeedAsync(ApplicationDbContext context, ILogger? logger = null, CancellationToken cancellationToken = default)
    {
        var existing = await context.MatchTierConfigs.Select(t => t.TierCode).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;

        // A colour an Admin picked is kept; only a row still on the old default moves to the new palette.
        var stale = await context.MatchTierConfigs
            .Where(t => OldDefaultColors.Keys.Contains(t.TierCode))
            .ToListAsync(cancellationToken);
        foreach (var row in stale)
        {
            if (string.Equals(row.ColorCode, OldDefaultColors[row.TierCode], StringComparison.OrdinalIgnoreCase))
            {
                row.ColorCode = Tiers.First(t => t.Code == row.TierCode).Color;
                row.UpdatedAt = now;
            }
        }
        foreach (var (code, name, min, max, color, order) in Tiers.Where(t => !existing.Contains(t.Code)))
        {
            context.MatchTierConfigs.Add(new MatchTierConfig
            {
                TierCode = code,
                DisplayName = name,
                MinScore = min,
                MaxScore = max,
                ColorCode = color,
                DisplayOrder = order,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);

            var tiers = await context.MatchTierConfigs.AsNoTracking().Where(t => t.IsActive).OrderBy(t => t.DisplayOrder).ToListAsync(cancellationToken);
            var missing = await context.AiMatchResults.Where(r => r.MatchScore != null && r.MatchTier == null).ToListAsync(cancellationToken);
            foreach (var result in missing)
            {
                result.MatchTier = tiers.FirstOrDefault(t => result.MatchScore >= t.MinScore && result.MatchScore <= t.MaxScore)?.TierCode;
            }
            if (missing.Count > 0)
            {
                await context.SaveChangesAsync(cancellationToken);
                logger?.LogInformation("Filled match tier for {Count} earlier AI result(s).", missing.Count);
            }
        }
        catch (DbUpdateException ex)
        {
            logger?.LogWarning(ex, "Match tiers not seeded (possibly seeded by another instance).");
            foreach (var entry in context.ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified))
            {
                entry.State = EntityState.Detached;
            }
        }
    }
}
