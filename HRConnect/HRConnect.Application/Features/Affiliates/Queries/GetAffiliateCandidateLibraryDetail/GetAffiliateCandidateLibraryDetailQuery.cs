using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateLibraryDetail;

public sealed record GetAffiliateCandidateLibraryDetailQuery(Guid UserId, Guid CandidateId)
    : IRequest<GetAffiliateCandidateLibraryDetailResponse>;
