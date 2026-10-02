using System;
using MediatR;

namespace HRConnect.Application.Features.Offers.Commands.UpdateOfferDraft;

public record UpdateOfferDraftCommand(
    Guid OfferId,
    decimal? Salary,
    string? CurrencyCode,
    DateOnly? StartDate,
    DateOnly? ExpiryDate,
    string? OfferDocumentUrl,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<UpdateOfferDraftResponse>;
