namespace HRConnect.Domain.Constants;

public static class ServiceAgreementStatuses
{
    public const string Draft = "DRAFT";
    public const string SentToClient = "SENT_TO_CLIENT";
    public const string ChangeRequested = "CHANGE_REQUESTED";
    public const string Accepted = "ACCEPTED";
    public const string AwaitingSignature = "AWAITING_SIGNATURE";
    public const string Signed = "SIGNED";
    public const string Void = "VOID";
    public const string LegacyConfirmed = "LEGACY_CONFIRMED";

    public static readonly string[] All =
    [
        Draft,
        SentToClient,
        ChangeRequested,
        Accepted,
        AwaitingSignature,
        Signed,
        Void,
        LegacyConfirmed
    ];
}

public static class ServiceAgreementResponseActions
{
    public const string Accept = "ACCEPT";
    public const string RequestChanges = "REQUEST_CHANGES";

    public static readonly string[] All = [Accept, RequestChanges];
}
