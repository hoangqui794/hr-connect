using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

public static class ServiceTypeAllowedRoleSeeder
{
    public static readonly (string ServiceTypeCode, string RoleCode, bool CanView, bool CanSubmit)[] ExpectedMappings =
    [
        ("HEADHUNT_COD", "AFFILIATE_RECRUITER", true, true),
        ("HEADHUNT_COD", "CANDIDATE", false, false),
        ("HEADHUNT_COD", "INTERNAL_HR", true, true),
        ("CV_APPLICATION", "CANDIDATE", true, true),
        ("CV_APPLICATION", "AFFILIATE_RECRUITER", false, false),
        ("CV_APPLICATION", "INTERNAL_HR", true, false),
        ("CV_SOURCING", "CANDIDATE", false, false),
        ("CV_SOURCING", "AFFILIATE_RECRUITER", true, true),
        ("CV_SOURCING", "INTERNAL_HR", true, true)
    ];

    public static async Task SeedAsync(
        ApplicationDbContext context,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var serviceTypeCodes = ExpectedMappings.Select(x => x.ServiceTypeCode).Distinct().ToList();
        var roleCodes = ExpectedMappings.Select(x => x.RoleCode).Distinct().ToList();

        var serviceTypes = await context.ServiceTypes
            .Where(x => serviceTypeCodes.Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var roles = await context.Roles
            .Where(x => roleCodes.Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var serviceTypeIds = serviceTypes.Values.Select(x => x.ServiceTypeId).ToList();
        var roleIds = roles.Values.Select(x => x.RoleId).ToList();
        var existing = await context.ServiceTypeAllowedRoles
            .Where(x => serviceTypeIds.Contains(x.ServiceTypeId) && roleIds.Contains(x.RoleId))
            .ToListAsync(cancellationToken);
        var existingByKey = existing.ToDictionary(x => (x.ServiceTypeId, x.RoleId));
        var now = DateTime.UtcNow;

        foreach (var mapping in ExpectedMappings)
        {
            if (!serviceTypes.TryGetValue(mapping.ServiceTypeCode, out var serviceType) ||
                !roles.TryGetValue(mapping.RoleCode, out var role))
            {
                continue;
            }

            if (existingByKey.TryGetValue((serviceType.ServiceTypeId, role.RoleId), out var current))
            {
                current.CanView = mapping.CanView;
                current.CanSubmit = mapping.CanSubmit;
                current.UpdatedAt = now;
                continue;
            }

            await context.ServiceTypeAllowedRoles.AddAsync(new ServiceTypeAllowedRole
            {
                ServiceTypeId = serviceType.ServiceTypeId,
                RoleId = role.RoleId,
                CanView = mapping.CanView,
                CanSubmit = mapping.CanSubmit,
                CreatedAt = now,
                UpdatedAt = now
            }, cancellationToken);
        }

        if (context.ChangeTracker.Entries<ServiceTypeAllowedRole>().Any(x => x.State == EntityState.Added))
        {
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Seeded missing service type role access mappings.");
        }
    }
}
