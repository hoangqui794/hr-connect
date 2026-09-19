using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateProfile;

public record GetAffiliateProfileQuery(Guid UserId) : IRequest<AffiliateProfileResponse>;
