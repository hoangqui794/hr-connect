using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class AffiliateApplicationRepository : IAffiliateApplicationRepository
{
    private readonly ApplicationDbContext _context;

    public AffiliateApplicationRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(AffiliateApplication application, CancellationToken cancellationToken = default)
    {
        await _context.AffiliateApplications.AddAsync(application, cancellationToken);
    }

    public async Task<AffiliateApplication?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.AffiliateApplications
            .FirstOrDefaultAsync(a => a.UserId == userId, cancellationToken);
    }

    public async Task<AffiliateApplication?> GetByIdAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.AffiliateApplications
            .FirstOrDefaultAsync(a => a.AffiliateApplicationId == applicationId, cancellationToken);
    }

    public async Task<AffiliateApplication?> GetByIdWithDetailsAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.AffiliateApplications
            .Include(a => a.User)
            .Include(a => a.ReviewedByNavigation)
            .FirstOrDefaultAsync(a => a.AffiliateApplicationId == applicationId, cancellationToken);
    }

    public void Update(AffiliateApplication application)
    {
        _context.AffiliateApplications.Update(application);
    }
}
