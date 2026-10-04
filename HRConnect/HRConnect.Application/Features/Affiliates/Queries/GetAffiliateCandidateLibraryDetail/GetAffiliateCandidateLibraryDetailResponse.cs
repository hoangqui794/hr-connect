namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateLibraryDetail;

public sealed record GetAffiliateCandidateLibraryDetailResponse
{
    public bool Success { get; init; } = true;
    public required AffiliateCandidateLibraryDetailDto Data { get; init; }
}

public sealed record AffiliateCandidateLibraryDetailDto(
    Guid CandidateId,
    string FullName,
    string? Email,
    string? Phone,
    bool HasAccount,
    int AcceptedSubmissionCount,
    IReadOnlyList<AffiliateCandidateCvDto> Cvs);

public sealed record AffiliateCandidateCvDto(
    Guid CvId,
    string Title,
    string? FileName,
    string? MimeType,
    long? FileSizeBytes,
    string Status,
    DateTime CreatedAt,
    int AcceptedSubmissionCount,
    DateTime? LastUsedAt);
