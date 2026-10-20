using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

/// <summary>SF-04 duplicate / attribution disputes.</summary>
public interface IDisputeRepository
{
    /// <summary>Submission with its job and candidate (read-only).</summary>
    Task<Submission?> GetSubmissionAsync(Guid submissionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// ACTIVE attribution of the candidate for the job, with its affiliate, commissions and the
    /// application's placement, tracked for update.
    /// </summary>
    Task<Attribution?> GetAttributionForUpdateAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    Task<AffiliateProfile?> GetAffiliateByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<bool> HasActiveDisputeAsync(Guid submissionId, CancellationToken cancellationToken = default);

    Task AddAsync(Dispute dispute, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Dispute>> GetRaisedByAsync(Guid userId, string? status, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<Dispute> Items, int TotalCount)> GetPageAsync(
        string? status, string? type, int page, int pageSize, CancellationToken cancellationToken = default);

    Task<Dispute?> GetByIdAsync(Guid disputeId, CancellationToken cancellationToken = default);

    /// <summary>Dispute with its submission (job, candidate), tracked for update.</summary>
    Task<Dispute?> GetForUpdateAsync(Guid disputeId, CancellationToken cancellationToken = default);

    /// <summary>Every submission of the candidate to the job, with consent, oldest first (D4).</summary>
    Task<IReadOnlyList<Submission>> GetSubmissionsForCandidateJobAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    /// <summary>Affiliate display names by user id, for the Admin view only.</summary>
    Task<IReadOnlyDictionary<Guid, string?>> GetAffiliateNamesByUserIdsAsync(IEnumerable<Guid> userIds, CancellationToken cancellationToken = default);
}
