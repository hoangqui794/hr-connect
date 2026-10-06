using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IInterviewRepository
{
    Task<(IReadOnlyList<Interview> Items, int TotalCount)> GetInterviewsAsync(
        Guid? companyId,
        Guid? candidateUserId,
        Guid? jobId,
        Guid? applicationId,
        Guid? interviewerId,
        string? status,
        string? result,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<Interview?> GetByIdAsync(Guid interviewId, CancellationToken cancellationToken = default);

    Task<Interview?> GetByIdWithDetailsAsync(Guid interviewId, CancellationToken cancellationToken = default);

    Task<Interview?> GetByIdForUpdateAsync(Guid interviewId, CancellationToken cancellationToken = default);

    Task AddAsync(Interview interview, CancellationToken cancellationToken = default);

    void Update(Interview interview);
}
