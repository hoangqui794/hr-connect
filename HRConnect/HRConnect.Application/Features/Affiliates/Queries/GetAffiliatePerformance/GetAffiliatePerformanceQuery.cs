using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;

public record GetAffiliatePerformanceQuery(Guid UserId) : IRequest<AffiliatePerformanceResponse>;
