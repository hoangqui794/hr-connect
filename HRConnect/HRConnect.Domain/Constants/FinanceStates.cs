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
    /// <summary>Referred, candidate not started yet.</summary>
    public const string Pending = "PENDING";
    /// <summary>Candidate started; inside the warranty window (QUY-TAC-PHI 1.3). Becomes EARNED when it passes.</summary>
    public const string InWarranty = "IN_WARRANTY";
    public const string Earned = "EARNED";
    public const string Payable = "PAYABLE";
    public const string Paid = "PAID";
    /// <summary>Client reported a resignation; Internal HR is verifying. Never auto-earned.</summary>
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
    /// <summary>Due within the reminder window (mf05.fee.due_reminder_days); the Client has been reminded.</summary>
    public const string Due = "DUE";
    public const string Paid = "PAID";
    public const string Overdue = "OVERDUE";
    public const string Cancelled = "CANCELLED";
}

/// <summary>
/// What a service fee bills. PLACEMENT is one HEADHUNT_COD placement; the others belong to a
/// CV_SOURCING job (QUY-TAC-PHI section 2, docs/MF05 section E8).
/// </summary>
public static class ServiceFeeKinds
{
    public const string Placement = "PLACEMENT";
    /// <summary>Paid in advance when the job is approved: sourcing target × price per CV × deposit percent.</summary>
    public const string Deposit = "DEPOSIT";
    /// <summary>Counted CVs × price per CV minus the deposit, billed once when the job is settled.</summary>
    public const string Settlement = "SETTLEMENT";
    /// <summary>The deposit exceeded what was delivered: refunded or deducted next time.</summary>
    public const string Credit = "CREDIT";

    public static readonly string[] All = [Placement, Deposit, Settlement, Credit];

    /// <summary>Kinds that close a CV_SOURCING job; at most one of them exists per job.</summary>
    public static readonly string[] Closing = [Settlement, Credit];
}

public static class CommissionMilestoneCodes
{
    public const string WarrantyPassed = "WARRANTY_PASSED";
    /// <summary>CV_SOURCING: the Client accepted the CV (or the review window ended without an answer).</summary>
    public const string CvAccepted = "CV_ACCEPTED";
}
