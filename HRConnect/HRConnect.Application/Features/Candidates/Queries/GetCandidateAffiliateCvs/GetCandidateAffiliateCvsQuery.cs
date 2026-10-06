using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvs;

public sealed record GetCandidateAffiliateCvsQuery(
    Guid UserId,
    int Page = 1,
    int PageSize = 20) : IRequest<GetCandidateAffiliateCvsResponse>;

public sealed record GetCandidateAffiliateCvsResponse(
    bool Success,
    CandidateAffiliateCvListData Data);

public sealed record CandidateAffiliateCvListData(
    IReadOnlyList<CandidateAffiliateCvItem> Items,
    CandidateAffiliateCvPagination Pagination);

public sealed record CandidateAffiliateCvItem(
    Guid CvId,
    string Title,
    string? FileName,
    string? MimeType,
    long? FileSizeBytes,
    string DocumentStatus,
    string AffiliateReuseStatus,
    Guid ReuseConcurrencyToken,
    Guid AffiliateUserId,
    string AffiliateDisplayName,
    int SubmissionCount,
    int PendingConsentCount,
    int AcceptedSubmissionCount,
    DateTime? LastSubmittedAt,
    DateTime CreatedAt);

public sealed record CandidateAffiliateCvPagination(
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);
