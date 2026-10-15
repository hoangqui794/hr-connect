namespace HRConnect.Domain.Constants;

/// <summary>Replacement slot states (MF-05). Shared by MF-02, MF-04 and MF-05.</summary>
public static class ReplacementSlotStates
{
    /// <summary>Candidate left, but the Client has not paid the fee yet.</summary>
    public const string WaitingPayment = "WAITING_PAYMENT";
    public const string Open = "OPEN";
    public const string Filled = "FILLED";
    public const string Cancelled = "CANCELLED";
    public const string Expired = "EXPIRED";

    public static readonly IReadOnlyList<string> All = [WaitingPayment, Open, Filled, Cancelled, Expired];
}

/// <summary>Stable error codes for replacement slots, so MF-02, MF-04 and MF-05 never retype the strings.</summary>
public static class ReplacementSlotErrorCodes
{
    /// <summary>MF-02: the candidate consented after the slot stopped being OPEN.</summary>
    public const string Unavailable = "REPLACEMENT_SLOT_UNAVAILABLE";

    /// <summary>MF-04: start-work confirmed after the slot stopped being OPEN.</summary>
    public const string AlreadyFilled = "REPLACEMENT_SLOT_ALREADY_FILLED";

    /// <summary>MF-05 (audit): no slot opened, e.g. the leaver was already a replacement.</summary>
    public const string NotAllowed = "REPLACEMENT_NOT_ALLOWED";

    public const string NotCancellable = "REPLACEMENT_SLOT_NOT_CANCELLABLE";

    public const string ConcurrencyConflict = "REPLACEMENT_SLOT_CONCURRENCY_CONFLICT";

    /// <summary>Job status history reason when a CLOSED job reopens for a replacement.</summary>
    public const string JobReopenedReason = "REOPENED_FOR_REPLACEMENT";
}
