using System;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;
using MediatR;

namespace HRConnect.Application.Features.Reports.Queries.GetAdminAffiliatePerformance;

public record GetAdminAffiliatePerformanceQuery(
    Guid AffiliateId,
    string? Period = "MONTH") : IRequest<AffiliatePerformanceResponse>;
