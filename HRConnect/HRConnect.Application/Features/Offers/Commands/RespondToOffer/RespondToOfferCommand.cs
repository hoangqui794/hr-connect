using System;
using MediatR;

namespace HRConnect.Application.Features.Offers.Commands.RespondToOffer;

public record RespondToOfferCommand(
    Guid OfferId,
    string Response,
    string? DeclineReason,
    Guid? ConcurrencyToken,
    Guid CurrentUserId
) : IRequest<RespondToOfferResponse>;
