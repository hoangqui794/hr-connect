using MediatR;

namespace HRConnect.Application.Features.Offers.Queries.GetOfferAcceptanceImpact;

public sealed record GetOfferAcceptanceImpactQuery(Guid OfferId, Guid CurrentUserId)
    : IRequest<GetOfferAcceptanceImpactResponse>;

public sealed record OfferAcceptanceImpactItem(
    Guid OfferId,
    Guid ApplicationId,
    string JobTitle,
    string CompanyName,
    string EmploymentType,
    string Status,
    DateOnly? PlannedStartDate);

public sealed record GetOfferAcceptanceImpactResponse(
    Guid TargetOfferId,
    string EmploymentType,
    bool IsFullTime,
    OfferAcceptanceImpactItem? AcceptedFullTimeOffer,
    IReadOnlyList<OfferAcceptanceImpactItem> OtherPendingFullTimeOffers,
    OfferAcceptanceImpactItem? ActiveFullTimePlacement,
    IReadOnlyList<string> AllowedActions);
