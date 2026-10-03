using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateCvDownloadUrl;

public sealed record GetAffiliateCandidateCvDownloadUrlQuery(Guid UserId, Guid CandidateId, Guid CvId)
    : IRequest<GetAffiliateCandidateCvDownloadUrlResponse>;
