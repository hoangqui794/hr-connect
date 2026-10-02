using System;
using MediatR;

namespace HRConnect.Application.Features.Offers.Queries.GetOffers;

public record GetOffersQuery(
    Guid CurrentUserId,
    Guid? ApplicationId = null,
    Guid? CandidateId = null,
    Guid? JobId = null,
    string? Status = null,
    int Page = 1,
    int PageSize = 10,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false,
    bool IsCandidate = false
) : IRequest<GetOffersResponse>;
