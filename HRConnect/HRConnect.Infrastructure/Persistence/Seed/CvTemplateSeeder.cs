using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

/// <summary>
/// BE-04 B: starting CV templates. Seeded by code and never overwritten, so Admin edits survive restarts.
/// TemplateConfig is read by CvPdfRenderer and the FE (accent, density, font, layout and sections).
/// </summary>
public static class CvTemplateSeeder
{
    private const string Sections = "\"sections\":[\"summary\",\"experiences\",\"projects\",\"educations\",\"activities\",\"skills\",\"languages\",\"certificates\"]";

    public static readonly (string Code, string Name, string Description, string Config)[] Templates =
    [
        ("CLASSIC_TEAL", "Cổ điển", "Bố cục một cột, nhấn màu xanh ngọc, hợp mọi ngành.",
            "{\"accentColor\":\"#0F766E\",\"density\":\"normal\",\"fontFamily\":\"BE_VIETNAM_PRO\",\"layout\":\"classic\"," + Sections + "}"),
        ("MODERN_BLUE", "Hiện đại", "Nhấn màu xanh dương, phù hợp CNTT và kỹ thuật.",
            "{\"accentColor\":\"#1D4ED8\",\"density\":\"normal\",\"fontFamily\":\"INTER\",\"layout\":\"modern\"," + Sections + "}"),
        ("COMPACT_GRAPHITE", "Gọn một trang", "Chữ nhỏ hơn để CV dài vẫn gọn, màu xám than.",
            "{\"accentColor\":\"#374151\",\"density\":\"compact\",\"fontFamily\":\"ROBOTO\",\"layout\":\"compact\"," + Sections + "}"),
        ("EXECUTIVE_NAVY", "Chuyên nghiệp", "Tiêu đề cân giữa, đường nhấn trang trọng cho vị trí quản lý.",
            "{\"accentColor\":\"#172554\",\"density\":\"normal\",\"fontFamily\":\"BE_VIETNAM_PRO\",\"layout\":\"executive\"," + Sections + "}"),
        ("ELEGANT_BURGUNDY", "Thanh lịch", "Bố cục cân đối, nhấn đỏ mận cho ngành dịch vụ và sáng tạo.",
            "{\"accentColor\":\"#881337\",\"density\":\"spacious\",\"fontFamily\":\"BE_VIETNAM_PRO\",\"layout\":\"elegant\"," + Sections + "}"),
        ("MINIMAL_SLATE", "Tối giản", "Tập trung vào nội dung, ít trang trí và dễ đọc ở mọi ngành.",
            "{\"accentColor\":\"#334155\",\"density\":\"normal\",\"fontFamily\":\"INTER\",\"layout\":\"minimal\"," + Sections + "}"),
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
