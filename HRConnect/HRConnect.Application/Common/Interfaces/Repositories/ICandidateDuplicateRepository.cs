using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICandidateDuplicateRepository
{
    Task<CandidateDuplicateMatch?> FindStrongCvNameMatchAsync(
        Guid candidateId,
        Guid jobId,
        string normalizedNameHash,
        string cvContentSha256,
        CancellationToken cancellationToken = default);

    Task AddSnapshotAsync(
        SubmissionIdentitySnapshot snapshot,
        CancellationToken cancellationToken = default);

    Task<CandidateDuplicateCase?> GetActiveSameJobCaseForSubmissionAsync(
        Guid submissionId,
        CancellationToken cancellationToken = default);

    Task<CandidateDuplicateCase> GetOrCreateStrongMatchCaseAsync(
        Guid candidateId,
        Guid matchedCandidateId,
        Guid submissionId,
        Guid? jobId,
        string keyVersion,
        DateTime now,
        CancellationToken cancellationToken = default);
}
