using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class SkillRepository : ISkillRepository
{
    private readonly ApplicationDbContext _context;

    public SkillRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(IReadOnlyList<Skill> Items, int TotalCount)> GetActiveAsync(
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
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

        return (items, totalCount);
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
}
