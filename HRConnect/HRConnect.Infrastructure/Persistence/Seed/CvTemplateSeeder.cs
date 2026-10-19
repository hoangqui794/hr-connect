using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

/// <summary>
/// BE-04 B: starting CV templates. Seeded by code and never overwritten, so Admin edits survive restarts.
/// TemplateConfig is read by CvPdfRenderer (accentColor, density) and by the FE (sections to show).
/// </summary>
public static class CvTemplateSeeder
{
    private const string Sections = "\"sections\":[\"personal\",\"summary\",\"experience\",\"education\",\"skills\",\"languages\",\"certificates\"]";

    public static readonly (string Code, string Name, string Description, string Config)[] Templates =
    [
        ("CLASSIC_TEAL", "Cổ điển", "Bố cục một cột, nhấn màu xanh ngọc, hợp mọi ngành.",
            "{\"accentColor\":\"#0F766E\",\"density\":\"normal\"," + Sections + "}"),
        ("MODERN_BLUE", "Hiện đại", "Nhấn màu xanh dương, phù hợp CNTT và kỹ thuật.",
            "{\"accentColor\":\"#1D4ED8\",\"density\":\"normal\"," + Sections + "}"),
        ("COMPACT_GRAPHITE", "Gọn một trang", "Chữ nhỏ hơn để CV dài vẫn gọn, màu xám than.",
            "{\"accentColor\":\"#374151\",\"density\":\"compact\"," + Sections + "}"),
    ];

    public static async Task SeedAsync(ApplicationDbContext context, ILogger? logger = null, CancellationToken cancellationToken = default)
    {
        var codes = Templates.Select(t => t.Code).ToList();
        var existing = await context.CvTemplates.Where(t => codes.Contains(t.Code)).Select(t => t.Code).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var added = 0;
        foreach (var (code, name, description, config) in Templates.Where(t => !existing.Contains(t.Code)))
        {
            await context.CvTemplates.AddAsync(new CvTemplate
            {
                CvTemplateId = Guid.NewGuid(),
                Code = code,
                Name = name,
                Description = description,
                TemplateConfig = config,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now,
            }, cancellationToken);
            added++;
        }

        if (added == 0) return;
        try
        {
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Seeded {Count} CV template(s).", added);
        }
        catch (DbUpdateException ex)
        {
            logger?.LogWarning(ex, "CV templates were not seeded (possibly seeded by another instance).");
            foreach (var entry in context.ChangeTracker.Entries<CvTemplate>().Where(e => e.State == EntityState.Added))
            {
                entry.State = EntityState.Detached;
            }
        }
    }
}
