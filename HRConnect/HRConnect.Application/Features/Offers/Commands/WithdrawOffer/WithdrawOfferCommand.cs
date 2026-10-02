using System;
using MediatR;

namespace HRConnect.Application.Features.Offers.Commands.WithdrawOffer;

public record WithdrawOfferCommand(
    Guid OfferId,
    string Reason,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<WithdrawOfferResponse>;
