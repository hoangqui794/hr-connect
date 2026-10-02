using System;
using MediatR;

namespace HRConnect.Application.Features.Offers.Commands.SendOffer;

public record SendOfferCommand(
    Guid OfferId,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<SendOfferResponse>;
