using System.Reflection;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

/// <summary>
/// BE-02 A: seeds industries and company sizes from the embedded CSV files (Seed/Data). Only missing codes are
/// added, so Admin edits survive restarts and a new CSV adds new rows without code changes. Afterwards, companies
/// whose old free-text industry / size matches a code or English name get the reference id.
/// </summary>
public static class CompanyTaxonomySeeder
{
    public static async Task SeedAsync(ApplicationDbContext context, ILogger? logger = null, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var added = 0;

        var industries = await context.Industries.ToDictionaryAsync(i => i.Code, cancellationToken);
        foreach (var row in ReadCsv("industry.csv").OrderBy(r => int.Parse(r["level"])))
        {
            if (industries.ContainsKey(row["code"])) continue;
            Guid? parentId = null;
            if (!string.IsNullOrEmpty(row["parent_code"]))
            {
                if (!industries.TryGetValue(row["parent_code"], out var parent))
                {
                    logger?.LogWarning("Industry {Code} skipped: parent {Parent} not found.", row["code"], row["parent_code"]);
                    continue;
                }
                parentId = parent.IndustryId;
            }

            var industry = new Industry
            {
                IndustryId = Guid.NewGuid(),
                Code = row["code"],
                NameEn = row["name_en"],
                NameVi = string.IsNullOrWhiteSpace(row["name_vi"]) ? null : row["name_vi"],
                Level = short.Parse(row["level"]),
                ParentId = parentId,
                SortOrder = int.Parse(row["sort_order"]),
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now,
            };
            context.Industries.Add(industry);
            industries[industry.Code] = industry;
            added++;
        }

        var sizes = await context.CompanySizes.ToDictionaryAsync(s => s.Code, cancellationToken);
        foreach (var row in ReadCsv("company_size.csv"))
        {
            if (sizes.ContainsKey(row["code"])) continue;
            var size = new CompanySizeOption
            {
                CompanySizeId = Guid.NewGuid(),
                Code = row["code"],
                Label = row["label"],
                MinEmployees = int.Parse(row["min_employees"]),
                MaxEmployees = string.IsNullOrEmpty(row["max_employees"]) ? null : int.Parse(row["max_employees"]),
                SortOrder = int.Parse(row["sort_order"]),
                IsActive = true,
            };
            context.CompanySizes.Add(size);
            sizes[size.Code] = size;
            added++;
        }

        var mapped = 0;
        var unmapped = await context.Companies
            .Where(c => (c.IndustryId == null && c.Industry != null) || (c.CompanySizeId == null && c.CompanySize != null))
            .ToListAsync(cancellationToken);
        foreach (var company in unmapped)
        {
            if (company.IndustryId == null && MatchIndustry(industries.Values, company.Industry) is { } industry)
            {
                company.IndustryId = industry.IndustryId;
                mapped++;
            }
            if (company.CompanySizeId == null && MatchSize(sizes.Values, company.CompanySize) is { } size)
            {
                company.CompanySizeId = size.CompanySizeId;
                mapped++;
            }
        }

        if (added == 0 && mapped == 0) return;
        try
        {
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Seeded {Added} industry/company size row(s); linked {Mapped} company field(s).", added, mapped);
        }
        catch (DbUpdateException ex)
        {
            logger?.LogWarning(ex, "Industry taxonomy not seeded (possibly seeded by another instance).");
            foreach (var entry in context.ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified))
            {
                entry.State = EntityState.Detached;
            }
        }
    }

    public static Industry? MatchIndustry(IEnumerable<Industry> industries, string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var value = text.Trim();
        return industries.FirstOrDefault(i => string.Equals(i.Code, value, StringComparison.OrdinalIgnoreCase))
            ?? industries.FirstOrDefault(i => string.Equals(i.NameEn, value, StringComparison.OrdinalIgnoreCase)
                                              || string.Equals(i.NameVi, value, StringComparison.OrdinalIgnoreCase));
    }

    public static CompanySizeOption? MatchSize(IEnumerable<CompanySizeOption> sizes, string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var value = new string(text.Where(c => char.IsDigit(c) || c is '-' or '+').ToArray());
        return sizes.FirstOrDefault(s => string.Equals(s.Code, value, StringComparison.OrdinalIgnoreCase))
            ?? sizes.FirstOrDefault(s => string.Equals(s.Label, text.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    internal static IReadOnlyList<Dictionary<string, string>> ReadCsv(string fileName)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resource = assembly.GetManifestResourceNames().Single(n => n.EndsWith("." + fileName, StringComparison.Ordinal));
        using var reader = new StreamReader(assembly.GetManifestResourceStream(resource)!);
        var lines = reader.ReadToEnd().Split('\n').Select(l => l.TrimEnd('\r')).Where(l => l.Length > 0).ToList();
        var header = ParseLine(lines[0]);
        return lines.Skip(1)
            .Select(ParseLine)
            .Select(values => header.Select((h, i) => (h, v: i < values.Count ? values[i] : string.Empty)).ToDictionary(x => x.h, x => x.v))
            .ToList();
    }

    private static List<string> ParseLine(string line)
    {
        var values = new List<string>();
        var current = new System.Text.StringBuilder();
        var quoted = false;
        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < line.Length && line[i + 1] == '"') { current.Append('"'); i++; }
                else if (c == '"') quoted = false;
                else current.Append(c);
            }
            else if (c == '"') quoted = true;
            else if (c == ',') { values.Add(current.ToString()); current.Clear(); }
            else current.Append(c);
        }
        values.Add(current.ToString());
        return values;
    }
}
