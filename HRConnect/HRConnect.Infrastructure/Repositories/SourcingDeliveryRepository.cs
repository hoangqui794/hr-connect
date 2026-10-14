using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Infrastructure.Repositories;

public class SourcingDeliveryRepository : ISourcingDeliveryRepository
{
    private readonly ApplicationDbContext _context;

    public SourcingDeliveryRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<Job?> GetJobAsync(Guid jobId, CancellationToken cancellationToken = default) =>
        _context.Jobs
            .Include(j => j.ServiceType)
            .FirstOrDefaultAsync(j => j.JobId == jobId, cancellationToken);

    public async Task<IReadOnlyList<JobApplication>> GetApplicationsAsync(
        Guid jobId, IReadOnlyCollection<Guid> applicationIds, CancellationToken cancellationToken = default) =>
        await _context.Applications
            .Include(a => a.Candidate)
            .Include(a => a.Submission).ThenInclude(s => s!.Consent)
            .Where(a => a.JobId == jobId && applicationIds.Contains(a.ApplicationId))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<SourcingDelivery>> GetByJobAsync(Guid jobId, CancellationToken cancellationToken = default) =>
        await _context.SourcingDeliveries
            .Include(d => d.Application).ThenInclude(a => a.Candidate)
            .Where(d => d.JobId == jobId)
            .ToListAsync(cancellationToken);

    public Task<SourcingDelivery?> GetByIdAsync(Guid deliveryId, CancellationToken cancellationToken = default) =>
        _context.SourcingDeliveries
            .Include(d => d.Job).ThenInclude(j => j.ServiceType)
            .Include(d => d.Application).ThenInclude(a => a.Candidate)
            .FirstOrDefaultAsync(d => d.DeliveryId == deliveryId, cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetDueForAutoAcceptAsync(DateTime now, int batchSize, CancellationToken cancellationToken = default) =>
        await _context.SourcingDeliveries.AsNoTracking()
            .Where(d => d.Status == SourcingDeliveryStates.Delivered && d.ReviewDueAt <= now)
            .OrderBy(d => d.ReviewDueAt)
            .Select(d => d.DeliveryId)
            .Take(batchSize)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(SourcingDelivery delivery, CancellationToken cancellationToken = default) =>
        await _context.SourcingDeliveries.AddAsync(delivery, cancellationToken);
}
