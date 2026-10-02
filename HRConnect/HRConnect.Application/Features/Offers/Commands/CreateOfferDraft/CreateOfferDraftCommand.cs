using System;
using MediatR;

namespace HRConnect.Application.Features.Offers.Commands.CreateOfferDraft;

public record CreateOfferDraftCommand(
    Guid ApplicationId,
    decimal? Salary,
    string? CurrencyCode,
    DateOnly? StartDate,
    DateOnly? ExpiryDate,
    string? OfferDocumentUrl,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<CreateOfferDraftResponse>;
