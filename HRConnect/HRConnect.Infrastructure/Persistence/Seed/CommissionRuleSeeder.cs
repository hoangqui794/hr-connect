using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

/// <summary>
/// Default HEADHUNT_COD commission rule: 30% of the service fee, earned in full when the 30-day
/// warranty passes. Seeded only when no rule exists for HEADHUNT_COD, so Admin edits are never overwritten.
/// </summary>
public static class CommissionRuleSeeder
{
    public const string HeadhuntCodServiceTypeCode = "HEADHUNT_COD";
    public const decimal DefaultHeadhuntPercent = 30m;

    public static async Task SeedAsync(
        ApplicationDbContext context,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var serviceTypeId = await context.ServiceTypes
            .Where(type => type.Code == HeadhuntCodServiceTypeCode)
            .Select(type => (Guid?)type.ServiceTypeId)
            .FirstOrDefaultAsync(cancellationToken);
        if (serviceTypeId == null
            || await context.CommissionRules.AnyAsync(rule => rule.ServiceTypeId == serviceTypeId.Value, cancellationToken))
        {
            return;
        }

        var now = DateTime.UtcNow;
        await context.CommissionRules.AddAsync(new CommissionRule
        {
            CommissionRuleId = Guid.NewGuid(),
            ServiceTypeId = serviceTypeId.Value,
            Name = "HEADHUNT_COD mặc định: 30% phí dịch vụ khi ứng viên đi làm đủ 30 ngày",
            MilestoneType = CommissionMilestoneCodes.WarrantyPassed,
            RateType = "PERCENT",
            RateValue = DefaultHeadhuntPercent,
            WarrantyRequired = true,
            EffectiveFrom = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
        }, cancellationToken);

        try
        {
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Seeded the default HEADHUNT_COD commission rule.");
        }
        catch (DbUpdateException ex)
        {
            logger?.LogWarning(ex, "Default HEADHUNT_COD commission rule was not seeded (possibly seeded by another instance).");
            foreach (var entry in context.ChangeTracker.Entries<CommissionRule>().Where(entry => entry.State == EntityState.Added))
            {
                entry.State = EntityState.Detached;
            }
        }
    }
}
