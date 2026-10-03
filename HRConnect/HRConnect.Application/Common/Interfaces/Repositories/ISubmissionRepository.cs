using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ISubmissionRepository
{
    Task<Submission?> GetAcceptedSubmissionAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

    Task<Submission?> GetPendingConsentSubmissionAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);

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

    Task<(IReadOnlyList<AffiliateCandidateLibraryRecord> Items, int TotalCount)> GetAffiliateCandidateLibraryAsync(
        Guid userId,
        string? search,
        string sortBy,
        string sortDirection,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AffiliateCandidateLibraryDetailRecord?> GetAffiliateCandidateLibraryDetailAsync(
        Guid userId,
        Guid candidateId,
        CancellationToken cancellationToken = default);
}

public sealed record AffiliateCandidateLibraryRecord(
    Guid CandidateId,
    string FullName,
    string? Email,
    string? Phone,
    bool HasAccount,
    int ActiveCvCount,
    int AcceptedSubmissionCount,
    DateTime? LastSubmittedAt);

public sealed record AffiliateCandidateLibraryDetailRecord(
    Guid CandidateId,
    string FullName,
    string? Email,
    string? Phone,
    bool HasAccount,
    int AcceptedSubmissionCount,
    IReadOnlyList<AffiliateCandidateCvRecord> Cvs);

public sealed record AffiliateCandidateCvRecord(
    Guid CvId,
    string Title,
    string? FileName,
    string? MimeType,
    long? FileSizeBytes,
    string Status,
    DateTime CreatedAt,
    int AcceptedSubmissionCount,
    DateTime? LastUsedAt);
