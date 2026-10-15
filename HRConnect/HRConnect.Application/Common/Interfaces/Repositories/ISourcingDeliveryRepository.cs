using HRConnect.Domain.Entities;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ISourcingDeliveryRepository
{
    /// <summary>Job with its Service Type, tracked.</summary>
    Task<Job?> GetJobAsync(Guid jobId, CancellationToken cancellationToken = default);

    /// <summary>Applications of the job with submission consent and status history, tracked.</summary>
    Task<IReadOnlyList<JobApplication>> GetApplicationsAsync(Guid jobId, IReadOnlyCollection<Guid> applicationIds, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SourcingDelivery>> GetByJobAsync(Guid jobId, CancellationToken cancellationToken = default);

    /// <summary>Delivery with its job and application/candidate, tracked.</summary>
    Task<SourcingDelivery?> GetByIdAsync(Guid deliveryId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetDueForAutoAcceptAsync(DateTime now, int batchSize, CancellationToken cancellationToken = default);

    Task AddAsync(SourcingDelivery delivery, CancellationToken cancellationToken = default);
}
