using System;

namespace HRConnect.Application.Features.Offers.Commands.SendOffer;

public record SendOfferResponse(
    Guid OfferId,
    Guid ApplicationId,
    int OfferVersion,
    string Status,
    DateTime SentAt,
    DateOnly? ExpiryDate,
    DateOnly? StartDate,
    decimal? Salary,
    string CurrencyCode,
    string? OfferDocumentUrl,
    Guid ConcurrencyToken,
    DateTime UpdatedAt
);
