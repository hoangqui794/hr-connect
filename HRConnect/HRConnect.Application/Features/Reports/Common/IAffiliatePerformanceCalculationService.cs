using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Reports.Common;

public interface IAffiliatePerformanceCalculationService
{
    Task<AffiliatePerformance> CalculateAndUpsertAsync(
        Guid affiliateId,
        DateOnly periodStart,
        DateOnly periodEnd,
        CancellationToken cancellationToken = default);

    Task<int> RecalculateAllActiveAffiliatesAsync(
        DateOnly periodStart,
        DateOnly periodEnd,
        CancellationToken cancellationToken = default);
}
