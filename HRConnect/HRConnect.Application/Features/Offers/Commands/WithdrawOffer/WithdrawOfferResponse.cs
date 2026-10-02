using System;

namespace HRConnect.Application.Features.Offers.Commands.WithdrawOffer;

public record WithdrawOfferResponse(
    Guid OfferId,
    Guid ApplicationId,
    int OfferVersion,
    string Status,
    string Reason,
    string ApplicationStatus,
    Guid ConcurrencyToken,
    DateTime UpdatedAt
);
