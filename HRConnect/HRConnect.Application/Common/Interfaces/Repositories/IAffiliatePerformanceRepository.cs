using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IAffiliatePerformanceRepository
{
    Task<AffiliatePerformance?> GetLatestPerformanceAsync(Guid affiliateId, CancellationToken cancellationToken = default);

    Task<AffiliatePerformance?> GetByPeriodAsync(Guid affiliateId, DateOnly periodStart, DateOnly periodEnd, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AffiliatePerformance>> GetHistoryAsync(Guid affiliateId, int limit = 12, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AffiliateProfile>> GetActiveAffiliatesAsync(CancellationToken cancellationToken = default);

    Task<(int Submissions, int Shortlisted, int Interviews, int Placements)> ComputeMetricsAsync(
        Guid affiliateId,
        DateOnly periodStart,
        DateOnly periodEnd,
        CancellationToken cancellationToken = default);

    Task<AffiliatePerformance> UpsertPerformanceAsync(AffiliatePerformance performance, CancellationToken cancellationToken = default);
}
