using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public sealed record CandidateDuplicateCaseUpsertResult(
    CandidateDuplicateCase DuplicateCase,
    bool Created);

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

    Task<(IReadOnlyList<CandidateDuplicateCase> Items, int TotalCount)> GetReviewPageAsync(
        string? status,
        string? riskLevel,
        Guid? jobId,
        Guid? companyId,
        DateTime? createdFrom,
        DateTime? createdTo,
        string? search,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<CandidateDuplicateCase> Items, int TotalCount)> GetCandidatePageAsync(
        Guid userId,
        string? status,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    Task<CandidateDuplicateCase?> GetByIdForCandidateAsync(
        Guid duplicateCaseId,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<CandidateDuplicateCase?> GetByIdForReviewAsync(
        Guid duplicateCaseId,
        CancellationToken cancellationToken = default);

    Task<CandidateDuplicateCase?> GetByIdForUpdateAsync(
        Guid duplicateCaseId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Candidate>> GetCandidatesForUpdateAsync(
        Guid candidateAId,
        Guid candidateBId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Submission>> GetRelatedSubmissionsAsync(
        Guid candidateAId,
        Guid candidateBId,
        Guid? jobId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Submission>> GetRelatedSubmissionsForUpdateAsync(
        Guid candidateAId,
        Guid candidateBId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Domain.Entities.Application>> GetCandidateApplicationsAsync(
        Guid candidateAId,
        Guid candidateBId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Domain.Entities.Application>> GetCandidateApplicationsForUpdateAsync(
        Guid candidateAId,
        Guid candidateBId,
        CancellationToken cancellationToken = default);

    Task<CandidateDuplicateCaseUpsertResult> GetOrCreateStrongMatchCaseAsync(
        Guid candidateId,
        Guid matchedCandidateId,
        Guid submissionId,
        Guid? jobId,
        string keyVersion,
        DateTime now,
        CancellationToken cancellationToken = default);

    Task<CandidateDuplicateCaseUpsertResult> GetOrCreateVerifiedIdentityClaimCaseAsync(
        Guid candidateId,
        Guid matchedCandidateId,
        Guid claimId,
        DateTime now,
        CancellationToken cancellationToken = default);
}
