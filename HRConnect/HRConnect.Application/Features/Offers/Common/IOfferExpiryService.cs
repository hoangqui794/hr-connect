using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Offers.Common;

public interface IOfferExpiryService
{
    Task<bool> ExpireAsync(
        Offer offer,
        DateTime now,
        CancellationToken cancellationToken = default);
}
