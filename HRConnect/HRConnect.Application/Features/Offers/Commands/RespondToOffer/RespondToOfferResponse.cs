using System;

namespace HRConnect.Application.Features.Offers.Commands.RespondToOffer;

public record RespondToOfferResponse(
    Guid OfferId,
    Guid ApplicationId,
    int OfferVersion,
    string Status,
    DateTime RespondedAt,
    string? DeclineReason,
    string ApplicationStatus,
    DateOnly? PlannedStartDate,
    Guid ConcurrencyToken,
    DateTime UpdatedAt
);
