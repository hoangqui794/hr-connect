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
        ("HIGH", "Rất phù hợp", 80m, 100m, "#16A34A", 1),
        ("MEDIUM_HIGH", "Khá phù hợp", 70m, 79.99m, "#0EA5E9", 2),
        ("MEDIUM", "Phù hợp một phần", 60m, 69.99m, "#F59E0B", 3),
        ("LOW", "Ít phù hợp", 0m, 59.99m, "#94A3B8", 4),
    ];

    public static async Task SeedAsync(ApplicationDbContext context, ILogger? logger = null, CancellationToken cancellationToken = default)
    {
        var existing = await context.MatchTierConfigs.Select(t => t.TierCode).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
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
