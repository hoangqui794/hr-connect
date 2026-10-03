namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateLibrary;

public sealed record GetAffiliateCandidateLibraryResponse
{
    public bool Success { get; init; } = true;
    public required AffiliateCandidateLibraryData Data { get; init; }
}

public sealed record AffiliateCandidateLibraryData
{
    public IReadOnlyList<AffiliateCandidateLibraryItemDto> Items { get; init; } = [];
    public required PaginationDto Pagination { get; init; }
}

public sealed record AffiliateCandidateLibraryItemDto(
    Guid CandidateId,
    string FullName,
    string? Email,
    string? Phone,
    bool HasAccount,
    int ActiveCvCount,
    int AcceptedSubmissionCount,
    DateTime? LastSubmittedAt);

public sealed record PaginationDto(
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);
