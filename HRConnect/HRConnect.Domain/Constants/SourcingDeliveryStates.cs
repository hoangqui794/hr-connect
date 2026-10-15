namespace HRConnect.Domain.Constants;

/// <summary>Persisted values of sourcing_delivery.status (MF-03, CV_SOURCING).</summary>
public static class SourcingDeliveryStates
{
    /// <summary>Handed to the Client, waiting for a decision.</summary>
    public const string Delivered = "DELIVERED";
    public const string Accepted = "ACCEPTED";
    public const string Rejected = "REJECTED";
    /// <summary>The review window ended without a decision; billed like ACCEPTED.</summary>
    public const string AutoAccepted = "AUTO_ACCEPTED";
    /// <summary>Rejected for a valid reason and swapped for another qualified CV.</summary>
    public const string Replaced = "REPLACED";

    public static readonly string[] All = [Delivered, Accepted, Rejected, AutoAccepted, Replaced];

    /// <summary>Deliveries that count toward the sourcing target and are billed.</summary>
    public static readonly string[] Counted = [Accepted, AutoAccepted];

    /// <summary>Deliveries that still occupy a slot of the sourcing target.</summary>
    public static readonly string[] Occupying = [Delivered, Accepted, AutoAccepted];
}

/// <summary>Valid reasons for a Client to reject a delivered CV (fee rules, section 2).</summary>
public static class SourcingRejectReasons
{
    public const string DuplicateAlreadyOwned = "DUPLICATE_ALREADY_OWNED";
    public const string FalseInformation = "FALSE_INFORMATION";
    public const string Unreachable = "UNREACHABLE";
    public const string WrongJob = "WRONG_JOB";
    public const string Other = "OTHER";

    public static readonly string[] All = [DuplicateAlreadyOwned, FalseInformation, Unreachable, WrongJob, Other];
}
