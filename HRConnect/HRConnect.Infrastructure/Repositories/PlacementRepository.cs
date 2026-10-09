using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class PlacementRepository : IPlacementRepository
{
    private readonly ApplicationDbContext _context;

    public PlacementRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(IReadOnlyList<Placement> Items, int TotalCount)> GetPlacementsAsync(
        Guid? companyId,
        Guid? jobId,
        Guid? candidateId,
        string? status,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Placements.AsNoTracking();

        if (companyId.HasValue && companyId.Value != Guid.Empty)
        {
            query = query.Where(p => p.Application.Job.CompanyId == companyId.Value);
        }

        if (jobId.HasValue && jobId.Value != Guid.Empty)
        {
            query = query.Where(p => p.Application.JobId == jobId.Value);
        }

        if (candidateId.HasValue && candidateId.Value != Guid.Empty)
        {
            query = query.Where(p => p.Application.CandidateId == candidateId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpperInvariant();
            query = query.Where(p => p.Status == normalizedStatus);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(p => p.ActualStartDate >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(p => p.ActualStartDate <= toDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(p => p.Application)
                .ThenInclude(a => a.Job)
                    .ThenInclude(j => j.Company)
            .Include(p => p.Application)
                .ThenInclude(a => a.Candidate)
                    .ThenInclude(c => c.User)
            .Include(p => p.Offer)
            .Include(p => p.ConfirmedByNavigation)
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<Placement?> GetByIdAsync(Guid placementId, CancellationToken cancellationToken = default)
    {
        return await _context.Placements
            .Include(p => p.Application)
                .ThenInclude(a => a.Job)
                    .ThenInclude(j => j.Company)
            .Include(p => p.Application)
                .ThenInclude(a => a.Candidate)
                    .ThenInclude(c => c.User)
            .Include(p => p.Offer)
            .Include(p => p.ConfirmedByNavigation)
            .FirstOrDefaultAsync(p => p.PlacementId == placementId, cancellationToken);
    }

    public async Task<Placement?> GetByIdWithDetailsAsync(Guid placementId, CancellationToken cancellationToken = default)
    {
        return await _context.Placements
            .AsNoTracking()
            .Include(p => p.Application)
                .ThenInclude(a => a.Job)
                    .ThenInclude(j => j.Company)
            .Include(p => p.Application)
                .ThenInclude(a => a.Candidate)
                    .ThenInclude(c => c.User)
            .Include(p => p.Offer)
            .Include(p => p.ConfirmedByNavigation)
            .Include(p => p.Probation)
            .Include(p => p.Warranty)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.PlacementId == placementId, cancellationToken);
    }

    public async Task<Placement?> GetByApplicationIdAsync(Guid applicationId, CancellationToken cancellationToken = default)
    {
        return await _context.Placements
            .Include(p => p.Application)
                .ThenInclude(a => a.Job)
                    .ThenInclude(j => j.Company)
            .Include(p => p.Application)
                .ThenInclude(a => a.Candidate)
                    .ThenInclude(c => c.User)
            .Include(p => p.Offer)
            .Include(p => p.ConfirmedByNavigation)
            .FirstOrDefaultAsync(p => p.ApplicationId == applicationId, cancellationToken);
    }

    public async Task<Placement?> GetByOfferIdAsync(Guid offerId, CancellationToken cancellationToken = default)
    {
        return await _context.Placements
            .Include(p => p.Application)
            .FirstOrDefaultAsync(p => p.OfferId == offerId, cancellationToken);
    }

    public async Task AddAsync(Placement placement, CancellationToken cancellationToken = default)
    {
        await _context.Placements.AddAsync(placement, cancellationToken);
    }

    public void Update(Placement placement)
    {
        var entry = _context.Entry(placement);
        if (entry.State == EntityState.Detached)
        {
            _context.Placements.Update(placement);
        }
    }
}
