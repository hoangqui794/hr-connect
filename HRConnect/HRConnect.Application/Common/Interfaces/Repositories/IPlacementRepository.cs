using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IPlacementRepository
{
    Task<(IReadOnlyList<Placement> Items, int TotalCount)> GetPlacementsAsync(
        Guid? companyId,
        Guid? jobId,
        Guid? candidateId,
        string? status,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<Placement?> GetByIdAsync(Guid placementId, CancellationToken cancellationToken = default);

    Task<Placement?> GetByIdWithDetailsAsync(Guid placementId, CancellationToken cancellationToken = default);

    Task<Placement?> GetByApplicationIdAsync(Guid applicationId, CancellationToken cancellationToken = default);

    Task<Placement?> GetByOfferIdAsync(Guid offerId, CancellationToken cancellationToken = default);

    Task AddAsync(Placement placement, CancellationToken cancellationToken = default);

    void Update(Placement placement);
}
