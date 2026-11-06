using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace HRConnect.Infrastructure.Repositories;

public sealed class SkillRepository : ISkillRepository
{
    private static readonly TimeSpan SkillCacheDuration = TimeSpan.FromMinutes(10);
    private readonly ApplicationDbContext _context;
    private readonly IMemoryCache? _cache;

    public SkillRepository(ApplicationDbContext context, IMemoryCache? cache = null)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<(IReadOnlyList<Skill> Items, int TotalCount)> GetActiveAsync(
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var normalizedSearch = string.IsNullOrWhiteSpace(search) ? string.Empty : search.Trim().ToLowerInvariant();
        var cacheKey = $"catalog:skills:{normalizedSearch}:{page}:{pageSize}";
        if (_cache != null && _cache.TryGetValue(cacheKey, out (IReadOnlyList<Skill> Items, int TotalCount) cached))
        {
            return cached;
        }

        var query = _context.Skills
            .AsNoTracking()
            .Where(skill => skill.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(skill =>
                EF.Functions.ILike(skill.SkillName, pattern) ||
                (skill.Category != null && EF.Functions.ILike(skill.Category, pattern)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(skill => skill.Category)
            .ThenBy(skill => skill.SkillName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var result = ((IReadOnlyList<Skill>)items, totalCount);
        if (_cache != null)
        {
            CacheExtensions.Set(_cache, cacheKey, result, SkillCacheDuration);
        }

        return result;
    }

    public async Task<IReadOnlyDictionary<Guid, Skill>> GetActiveByIdsAsync(
        IReadOnlyCollection<Guid> skillIds,
        CancellationToken cancellationToken = default)
    {
        if (skillIds.Count == 0)
        {
            return new Dictionary<Guid, Skill>();
        }

        return await _context.Skills
            .AsNoTracking()
            .Where(skill => skillIds.Contains(skill.SkillId) && skill.IsActive)
            .ToDictionaryAsync(skill => skill.SkillId, cancellationToken);
    }

    public async Task<Skill> GetOrCreateByNameAsync(
        string skillName,
        string? category = null,
        CancellationToken cancellationToken = default)
    {
        var trimmed = skillName.Trim();
        var normalized = trimmed.ToUpperInvariant();
        var existing = await _context.Skills
            .FirstOrDefaultAsync(s => s.NormalizedName == normalized || EF.Functions.ILike(s.SkillName, trimmed), cancellationToken);

        if (existing != null)
        {
            if (!existing.IsActive)
            {
                existing.IsActive = true;
                await _context.SaveChangesAsync(cancellationToken);
            }
            return existing;
        }

        var newSkill = new Skill
        {
            SkillId = Guid.NewGuid(),
            SkillName = trimmed,
            NormalizedName = normalized,
            Category = string.IsNullOrWhiteSpace(category) ? "Khác" : category.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Skills.Add(newSkill);
        await _context.SaveChangesAsync(cancellationToken);
        return newSkill;
    }
}
