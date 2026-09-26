using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IOfferRepository
{
    Task<(IReadOnlyList<Offer> Items, int TotalCount)> GetOffersAsync(
        Guid? companyId,
        Guid? candidateUserId,
        Guid? jobId,
        Guid? applicationId,
        Guid? candidateId,
        string? status,
        bool hideDraftForCandidate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<Offer?> GetByIdAsync(Guid offerId, CancellationToken cancellationToken = default);

    Task<Offer?> GetByIdWithDetailsAsync(Guid offerId, CancellationToken cancellationToken = default);

    Task AddAsync(Offer offer, CancellationToken cancellationToken = default);

    void Update(Offer offer);
}
