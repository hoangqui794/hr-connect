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

public class OfferRepository : IOfferRepository
{
    private readonly ApplicationDbContext _context;

    public OfferRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(IReadOnlyList<Offer> Items, int TotalCount)> GetOffersAsync(
        Guid? companyId,
        Guid? candidateUserId,
        Guid? jobId,
        Guid? applicationId,
        Guid? candidateId,
        string? status,
        bool hideDraftForCandidate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Offers.AsNoTracking();

        if (companyId.HasValue && companyId.Value != Guid.Empty)
        {
            query = query.Where(o => o.Application.Job.CompanyId == companyId.Value);
        }

        if (candidateUserId.HasValue && candidateUserId.Value != Guid.Empty)
        {
            query = query.Where(o => o.Application.Candidate.UserId == candidateUserId.Value);
        }

        if (jobId.HasValue && jobId.Value != Guid.Empty)
        {
            query = query.Where(o => o.Application.JobId == jobId.Value);
        }

        if (applicationId.HasValue && applicationId.Value != Guid.Empty)
        {
            query = query.Where(o => o.ApplicationId == applicationId.Value);
        }

        if (candidateId.HasValue && candidateId.Value != Guid.Empty)
        {
            query = query.Where(o => o.Application.CandidateId == candidateId.Value);
        }

        if (hideDraftForCandidate)
        {
            query = query.Where(o => o.Status != "DRAFT" && o.Status != "PENDING_APPROVAL" && o.Status != "REJECTED");
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpperInvariant();
            query = query.Where(o => o.Status == normalizedStatus);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(o => o.Application)
                .ThenInclude(a => a.Job)
                    .ThenInclude(j => j.Company)
            .Include(o => o.Application)
                .ThenInclude(a => a.Candidate)
                    .ThenInclude(c => c.User)
            .Include(o => o.CreatedByNavigation)
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<Offer?> GetByIdAsync(Guid offerId, CancellationToken cancellationToken = default)
    {
        return await _context.Offers
            .FirstOrDefaultAsync(o => o.OfferId == offerId, cancellationToken);
    }

    public async Task<Offer?> GetByIdWithDetailsAsync(Guid offerId, CancellationToken cancellationToken = default)
    {
        return await _context.Offers
            .AsNoTracking()
            .Include(o => o.Application)
                .ThenInclude(a => a.Job)
                    .ThenInclude(j => j.Company)
            .Include(o => o.Application)
                .ThenInclude(a => a.Candidate)
                    .ThenInclude(c => c.User)
            .Include(o => o.CreatedByNavigation)
            .Include(o => o.OfferApprovals)
                .ThenInclude(oa => oa.User)
            .Include(o => o.Placements)
            .AsSplitQuery()
            .FirstOrDefaultAsync(o => o.OfferId == offerId, cancellationToken);
    }

    public async Task AddAsync(Offer offer, CancellationToken cancellationToken = default)
    {
        await _context.Offers.AddAsync(offer, cancellationToken);
    }

    public void Update(Offer offer)
    {
        _context.Offers.Update(offer);
    }
}
