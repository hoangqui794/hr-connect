using System;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;

public record GetAffiliatePerformanceQuery(Guid UserId, string? Period = "MONTH") : IRequest<AffiliatePerformanceResponse>;
