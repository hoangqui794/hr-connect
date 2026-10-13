using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICandidateSavedJobRepository
{
    Task<bool> IsSavedAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    Task AddAsync(CandidateSavedJob savedJob, CancellationToken cancellationToken = default);

    Task<bool> RemoveAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<CandidateSavedJob> Items, int TotalCount)> GetSavedJobsAsync(
        Guid candidateId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
