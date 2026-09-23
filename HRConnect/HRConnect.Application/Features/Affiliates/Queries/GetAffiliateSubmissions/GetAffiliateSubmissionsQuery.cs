using System;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissions;

public sealed record GetAffiliateSubmissionsQuery(
    Guid UserId,
    string? Status = null,
    Guid? JobId = null,
    Guid? CandidateId = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<AffiliateSubmissionsResponse>;
