using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

public static class CommissionMilestoneSeeder
{
    public static readonly (string Code, string Name, string Description, bool IsActive)[] ExpectedMilestones =
    [
        ("APPLICATION_CREATED", "Application Created", "A candidate application has been created.", true),
        ("START_WORK", "Start Work", "The placed candidate has started work.", true),
        ("PROBATION_PASSED", "Probation Passed", "The placed candidate has successfully completed probation.", true),
        ("WARRANTY_PASSED", "Warranty Passed", "The placement has completed its warranty period.", true)
    ];

    public static async Task SeedAsync(
        ApplicationDbContext context,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var expectedCodes = ExpectedMilestones.Select(milestone => milestone.Code).ToList();
        var existingCodes = await context.CommissionMilestones
            .Where(milestone => expectedCodes.Contains(milestone.MilestoneCode))
            .Select(milestone => milestone.MilestoneCode)
            .ToListAsync(cancellationToken);

        var existingCodeSet = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);
        var missingMilestones = ExpectedMilestones
            .Where(milestone => !existingCodeSet.Contains(milestone.Code))
            .ToList();

        if (missingMilestones.Count == 0)
        {
            return;
        }

        var now = DateTime.UtcNow;
        foreach (var (code, name, description, isActive) in missingMilestones)
        {
            await context.CommissionMilestones.AddAsync(new CommissionMilestone
            {
                MilestoneCode = code,
                Name = name,
                Description = description,
                IsActive = isActive,
                CreatedAt = now,
                UpdatedAt = now
            }, cancellationToken);
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Commission milestone seed completed. Inserted {Count} missing record(s).", missingMilestones.Count);
        }
        catch (DbUpdateException ex)
        {
            logger?.LogWarning(ex, "Commission milestone seed encountered a concurrency conflict. Records may have already been seeded by another instance.");
            foreach (var entry in context.ChangeTracker.Entries<CommissionMilestone>().Where(entry => entry.State == EntityState.Added))
            {
                entry.State = EntityState.Detached;
            }
        }
    }
}
