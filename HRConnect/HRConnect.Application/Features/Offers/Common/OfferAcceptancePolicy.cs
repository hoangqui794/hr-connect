using HRConnect.Application.Features.Jobs.Common;

namespace HRConnect.Application.Features.Offers.Common;

public static class OfferAcceptanceActions
{
    public const string KeepOtherPendingOffers = "KEEP_OTHER_PENDING_OFFERS";
    public const string WithdrawOtherPendingFullTimeOffers = "WITHDRAW_OTHER_PENDING_FULL_TIME_OFFERS";
    public const string ReplaceAcceptedFullTimeOffer = "REPLACE_ACCEPTED_FULL_TIME_OFFER";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        KeepOtherPendingOffers,
        WithdrawOtherPendingFullTimeOffers,
        ReplaceAcceptedFullTimeOffer
    };
}

public static class OfferAcceptanceErrorCodes
{
    public const string AcceptedFullTimeOfferExists = "ACCEPTED_FULL_TIME_OFFER_EXISTS";
    public const string ActiveFullTimePlacementExists = "ACTIVE_FULL_TIME_PLACEMENT_EXISTS";
    public const string ActiveFullTimePlacementConflict = "ACTIVE_FULL_TIME_PLACEMENT_CONFLICT";
    public const string InvalidAcceptanceAction = "INVALID_OFFER_ACCEPTANCE_ACTION";
}

public static class OfferAcceptancePolicy
{
    public static bool IsFullTime(string? employmentType) =>
        string.Equals(employmentType, EmploymentTypes.FullTime, StringComparison.OrdinalIgnoreCase);

    public static string NormalizeAction(string? action) =>
        string.IsNullOrWhiteSpace(action)
            ? OfferAcceptanceActions.KeepOtherPendingOffers
            : action.Trim().ToUpperInvariant();
}
