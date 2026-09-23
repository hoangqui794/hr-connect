using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ISubmissionRepository
{
    Task<Submission?> GetAcceptedSubmissionAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    Task<Submission?> GetByIdAsync(Guid submissionId, CancellationToken cancellationToken = default);

    Task AddAsync(Submission submission, CancellationToken cancellationToken = default);

    void Update(Submission submission);

    Task<(IReadOnlyList<Submission> Items, int TotalCount)> GetAffiliateSubmissionsAsync(
        Guid userId,
        string? status,
        Guid? jobId,
        Guid? candidateId,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<Submission?> GetByIdWithDetailsAsync(Guid submissionId, CancellationToken cancellationToken = default);
}
