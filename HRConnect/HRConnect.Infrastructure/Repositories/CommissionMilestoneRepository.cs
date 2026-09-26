using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class CommissionMilestoneRepository : ICommissionMilestoneRepository
{
    private readonly ApplicationDbContext _context;

    public CommissionMilestoneRepository(ApplicationDbContext context) => _context = context;

    public async Task<IReadOnlyList<CommissionMilestone>> GetListAsync(
        bool? isActive,
        CancellationToken cancellationToken = default)
    {
        var query = _context.CommissionMilestones.AsNoTracking().AsQueryable();
        if (isActive.HasValue)
        {
            query = query.Where(milestone => milestone.IsActive == isActive.Value);
        }

        return await query
            .OrderBy(milestone => milestone.MilestoneCode)
            .ToListAsync(cancellationToken);
    }
}
