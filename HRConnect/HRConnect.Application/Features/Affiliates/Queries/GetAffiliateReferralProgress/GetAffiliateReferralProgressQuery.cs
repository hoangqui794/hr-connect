using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateReferralProgress;

public sealed record GetAffiliateReferralProgressQuery(Guid UserId, Guid? JobId = null, int Page = 1, int PageSize = 20)
    : IRequest<AffiliateReferralProgressResponse>;
