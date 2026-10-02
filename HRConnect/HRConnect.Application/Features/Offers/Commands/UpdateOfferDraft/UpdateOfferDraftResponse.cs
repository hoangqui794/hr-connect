using System;

namespace HRConnect.Application.Features.Offers.Commands.UpdateOfferDraft;

public record UpdateOfferDraftResponse(
    Guid OfferId,
    Guid ApplicationId,
    int OfferVersion,
    decimal? Salary,
    string CurrencyCode,
    DateOnly? StartDate,
    DateOnly? ExpiryDate,
    string Status,
    string? OfferDocumentUrl,
    Guid ConcurrencyToken,
    DateTime UpdatedAt
);
