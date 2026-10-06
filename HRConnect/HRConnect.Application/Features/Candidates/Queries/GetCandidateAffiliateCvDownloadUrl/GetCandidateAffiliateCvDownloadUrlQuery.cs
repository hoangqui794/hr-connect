using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvDownloadUrl;

public sealed record GetCandidateAffiliateCvDownloadUrlQuery(Guid UserId, Guid CvId)
    : IRequest<GetCandidateAffiliateCvDownloadUrlResponse>;

public sealed record GetCandidateAffiliateCvDownloadUrlResponse(
    bool Success,
    CandidateAffiliateCvDownloadUrlData Data);

public sealed record CandidateAffiliateCvDownloadUrlData(
    Guid CvId,
    string FileName,
    string MimeType,
    string DownloadUrl,
    DateTime ExpiresAt);
