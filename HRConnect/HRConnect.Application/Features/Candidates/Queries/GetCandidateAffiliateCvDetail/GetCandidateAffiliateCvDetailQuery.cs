using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvDetail;

public sealed record GetCandidateAffiliateCvDetailQuery(Guid UserId, Guid CvId)
    : IRequest<GetCandidateAffiliateCvDetailResponse>;

public sealed record GetCandidateAffiliateCvDetailResponse(
    bool Success,
    CandidateAffiliateCvDetailData Data);

public sealed record CandidateAffiliateCvDetailData(
    Guid CvId,
    string Title,
    string? FileName,
    string? MimeType,
    long? FileSizeBytes,
    string DocumentStatus,
    string AffiliateReuseStatus,
    Guid ReuseConcurrencyToken,
    DateTime? ReuseChangedAt,
    Guid AffiliateUserId,
    string AffiliateDisplayName,
    int SubmissionCount,
    int PendingConsentCount,
    int AcceptedSubmissionCount,
    int DeclinedSubmissionCount,
    int ExpiredSubmissionCount,
    DateTime? LastSubmittedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);
