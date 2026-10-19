namespace HRConnect.Domain.Constants;

/// <summary>
/// SF-04 duplicate / attribution disputes (docs/tasks/BE-tasks-03-tranh-chap-trung-sf04.md, minimal scope).
/// The minimal flow goes straight from OPEN to UPHELD or REJECTED; UNDER_REVIEW and WITHDRAWN are reserved
/// for the full flow and allowed by the check constraint.
/// </summary>
public static class DisputeStates
{
    public const string Open = "OPEN";
    public const string UnderReview = "UNDER_REVIEW";
    public const string Upheld = "UPHELD";
    public const string Rejected = "REJECTED";
    public const string Withdrawn = "WITHDRAWN";

    public static readonly string[] All = [Open, UnderReview, Upheld, Rejected, Withdrawn];

    /// <summary>States that still block approving the related commission (D3).</summary>
    public static readonly string[] Active = [Open, UnderReview];
}

public static class DisputeTypes
{
    /// <summary>The affiliate's submission was BLOCKED_DUPLICATE but it claims the candidate.</summary>
    public const string DuplicateSubmission = "DUPLICATE_SUBMISSION";

    /// <summary>The candidate's attribution belongs to another affiliate but this one claims it.</summary>
    public const string Attribution = "ATTRIBUTION";

    public static readonly string[] All = [DuplicateSubmission, Attribution];
}

public static class DisputeErrorCodes
{
    public const string AlreadyOpen = "DISPUTE_ALREADY_OPEN";
    public const string WindowClosed = "DISPUTE_WINDOW_CLOSED";
    public const string NotEligible = "DISPUTE_NOT_ELIGIBLE";
    public const string NotOpen = "DISPUTE_NOT_OPEN";
    public const string CommissionUnderDispute = "COMMISSION_UNDER_DISPUTE";
    /// <summary>UPHELD would move a commission that was already paid out; settle it outside the system first.</summary>
    public const string CommissionAlreadyPaid = "DISPUTE_COMMISSION_ALREADY_PAID";
}

public static class AttributionRules
{
    public const string DisputeResolution = "DISPUTE_RESOLUTION";
}
