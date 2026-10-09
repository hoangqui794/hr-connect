namespace HRConnect.Domain.Constants;

/// <summary>
/// Canonical persisted values for the MF-05 lifecycle (service fee, warranty, commission, payout).
/// HEADHUNT_COD: the affiliate earns the whole commission once the candidate has worked through the
/// warranty period (30 days by default); there is no partial milestone split.
/// </summary>
public static class WarrantyStates
{
    public const string Active = "ACTIVE";
    /// <summary>Client reported the candidate left before the end date; Internal HR must verify.</summary>
    public const string Claimed = "CLAIMED";
    public const string Passed = "PASSED";
    /// <summary>Leaving within the warranty was confirmed; the commission is cancelled.</summary>
    public const string Voided = "VOIDED";
}

public static class CommissionStates
{
    public const string Pending = "PENDING";
    public const string Earned = "EARNED";
    public const string Payable = "PAYABLE";
    public const string Paid = "PAID";
    public const string OnHold = "ON_HOLD";
    public const string Cancelled = "CANCELLED";
}

public static class PayoutStates
{
    public const string Pending = "PENDING";
    public const string Completed = "COMPLETED";
    public const string Failed = "FAILED";
    public const string Cancelled = "CANCELLED";
}

public static class ServiceFeeStates
{
    public const string Pending = "PENDING";
    public const string Paid = "PAID";
    public const string Overdue = "OVERDUE";
    public const string Cancelled = "CANCELLED";
}

public static class CommissionMilestoneCodes
{
    public const string WarrantyPassed = "WARRANTY_PASSED";
}
