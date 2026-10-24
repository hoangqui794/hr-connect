using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class PlacementReconciliationRepository : IPlacementReconciliationRepository
{
    private readonly ApplicationDbContext _context;

    public PlacementReconciliationRepository(ApplicationDbContext context) => _context = context;

    public async Task AddAsync(PlacementReconciliation reconciliation, CancellationToken cancellationToken = default) =>
        await _context.PlacementReconciliations.AddAsync(reconciliation, cancellationToken);

    public Task<PlacementReconciliation?> GetByApplicationIdAsync(
        Guid applicationId,
        bool tracking = true,
        CancellationToken cancellationToken = default)
    {
        IQueryable<PlacementReconciliation> query = IncludeDetails(_context.PlacementReconciliations);
        if (!tracking) query = query.AsNoTracking();
        return query.SingleOrDefaultAsync(item => item.ApplicationId == applicationId, cancellationToken);
    }

    public Task<PlacementReconciliation?> GetByServiceFeeIdAsync(Guid serviceFeeId, CancellationToken cancellationToken = default) =>
        _context.PlacementReconciliations.AsNoTracking()
            .SingleOrDefaultAsync(item => item.Placement != null &&
                                          item.Placement.ServiceFee != null &&
                                          item.Placement.ServiceFee.ServiceFeeId == serviceFeeId,
                cancellationToken);

    public async Task<(IReadOnlyList<PlacementReconciliation> Items, int TotalCount)> GetPageAsync(
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = IncludeDetails(_context.PlacementReconciliations).AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToUpperInvariant();
            query = query.Where(item => item.Status == normalized);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(item => item.Status == "PENDING" ? 0 : item.Status == "FLAGGED" ? 1 : 2)
            .ThenByDescending(item => item.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, totalCount);
    }

    public async Task<IReadOnlyList<Guid>> GetActivePlatformAdminUserIdsAsync(CancellationToken cancellationToken = default) =>
        await _context.UserRoles.AsNoTracking()
            .Where(item => item.Status == "ACTIVE" &&
                           item.User.Status == "ACTIVE" &&
                           item.Role.IsActive &&
                           item.Role.Code == "PLATFORM_ADMIN")
            .Select(item => item.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);

    public Task<Guid?> GetAttributedAffiliateUserIdAsync(Guid applicationId, CancellationToken cancellationToken = default) =>
        _context.Attributions.AsNoTracking()
            .Where(item => item.ApplicationId == applicationId && item.Status == "ACTIVE")
            .Select(item => (Guid?)item.Affiliate.UserId)
            .SingleOrDefaultAsync(cancellationToken);

    private static IQueryable<PlacementReconciliation> IncludeDetails(IQueryable<PlacementReconciliation> query) =>
        query
            .Include(item => item.Application).ThenInclude(application => application.Job).ThenInclude(job => job.Company)
            .Include(item => item.Application).ThenInclude(application => application.Candidate)
            .Include(item => item.Application).ThenInclude(application => application.Attribution).ThenInclude(attribution => attribution!.Affiliate).ThenInclude(affiliate => affiliate.User)
            .Include(item => item.Placement).ThenInclude(placement => placement!.ServiceFee);
}
