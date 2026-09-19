using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class AffiliateProfileRepository : IAffiliateProfileRepository
{
    private readonly ApplicationDbContext _context;

    public AffiliateProfileRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AffiliateProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.AffiliateProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
    }

    public async Task<AffiliateProfile?> GetByUserIdWithDetailsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.AffiliateProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
    }

    public async Task<AffiliateProfile?> GetByIdAsync(Guid affiliateId, CancellationToken cancellationToken = default)
    {
        return await _context.AffiliateProfiles
            .FirstOrDefaultAsync(p => p.AffiliateId == affiliateId, cancellationToken);
    }

    public async Task<AffiliatePerformance?> GetLatestPerformanceByAffiliateIdAsync(Guid affiliateId, CancellationToken cancellationToken = default)
    {
        return await _context.AffiliatePerformances
            .Where(p => p.AffiliateId == affiliateId)
            .OrderByDescending(p => p.PeriodEnd)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(AffiliateProfile profile, CancellationToken cancellationToken = default)
    {
        await _context.AffiliateProfiles.AddAsync(profile, cancellationToken);
    }

    public void Update(AffiliateProfile profile)
    {
        _context.AffiliateProfiles.Update(profile);
    }
}
