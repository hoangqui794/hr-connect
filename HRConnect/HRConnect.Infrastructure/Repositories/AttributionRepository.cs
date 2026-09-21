using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class AttributionRepository : IAttributionRepository
{
    private readonly ApplicationDbContext _context;

    public AttributionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Attribution?> GetByApplicationIdAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.Attributions
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId, cancellationToken);
    }

    public async Task<Attribution?> GetByWinningSubmissionIdAsync(Guid winningSubmissionId, CancellationToken cancellationToken = default)
    {
        return await _context.Attributions
            .FirstOrDefaultAsync(a => a.WinningSubmissionId == winningSubmissionId, cancellationToken);
    }

    public async Task AddAsync(Attribution attribution, CancellationToken cancellationToken = default)
    {
        await _context.Attributions.AddAsync(attribution, cancellationToken);
    }

    public void Update(Attribution attribution)
    {
        _context.Attributions.Update(attribution);
    }
}
