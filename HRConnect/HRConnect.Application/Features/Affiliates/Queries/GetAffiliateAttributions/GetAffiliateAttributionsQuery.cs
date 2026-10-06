using System;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateAttributions;

public sealed record GetAffiliateAttributionsQuery(
    Guid UserId,
    Guid? JobId = null,
    Guid? CandidateId = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<AffiliateAttributionsResponse>;
