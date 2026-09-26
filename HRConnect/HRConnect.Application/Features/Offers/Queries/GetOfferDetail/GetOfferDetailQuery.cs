using System;
using MediatR;

namespace HRConnect.Application.Features.Offers.Queries.GetOfferDetail;

public record GetOfferDetailQuery(
    Guid OfferId,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false,
    bool IsCandidate = false
) : IRequest<GetOfferDetailResponse>;
