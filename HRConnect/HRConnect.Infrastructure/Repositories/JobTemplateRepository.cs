using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class JobTemplateRepository : IJobTemplateRepository
{
    private readonly ApplicationDbContext _context;

    public JobTemplateRepository(ApplicationDbContext context) => _context = context;

    public async Task<IReadOnlyList<JobTemplate>> SearchAsync(
        IReadOnlyCollection<string> tokens, string? industry, bool? isActive, CancellationToken cancellationToken = default)
    {
        var query = _context.JobTemplates.AsNoTracking().Include(t => t.Requirements).AsQueryable();
        if (isActive.HasValue) query = query.Where(t => t.IsActive == isActive.Value);
        if (!string.IsNullOrWhiteSpace(industry)) query = query.Where(t => t.Industry == industry);
        // search_text is stored lower-cased and accent-free, so a plain substring match is enough.
        foreach (var token in tokens)
        {
            query = query.Where(t => t.SearchText.Contains(token));
        }
        return await query.ToListAsync(cancellationToken);
    }

    public Task<JobTemplate?> GetByIdAsync(Guid templateId, CancellationToken cancellationToken = default) =>
        _context.JobTemplates.Include(t => t.Requirements).FirstOrDefaultAsync(t => t.TemplateId == templateId, cancellationToken);

    public Task<bool> CodeExistsAsync(string code, Guid? exceptTemplateId, CancellationToken cancellationToken = default) =>
        _context.JobTemplates.AnyAsync(t => t.Code == code && (!exceptTemplateId.HasValue || t.TemplateId != exceptTemplateId.Value), cancellationToken);

    public async Task AddAsync(JobTemplate template, CancellationToken cancellationToken = default) =>
        await _context.JobTemplates.AddAsync(template, cancellationToken);

    public void ReplaceRequirements(IEnumerable<JobTemplateRequirement> oldRequirements, IEnumerable<JobTemplateRequirement> newRequirements)
    {
        _context.JobTemplateRequirements.RemoveRange(oldRequirements);
        // New rows carry client-generated keys, so mark them Added explicitly instead of letting EF guess "existing".
        _context.JobTemplateRequirements.AddRange(newRequirements);
    }
}
