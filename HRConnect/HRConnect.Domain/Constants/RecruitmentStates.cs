namespace HRConnect.Domain.Constants;

/// <summary>
/// Canonical persisted values for the MF-04 recruitment lifecycle.
/// Keep these values aligned with the database constraints and API contracts.
/// </summary>
public static class ApplicationStates
{
    public const string Submitted = "SUBMITTED";
    public const string Screening = "SCREENING";
    public const string Shortlisted = "SHORTLISTED";
    public const string Rejected = "REJECTED";
    public const string Interview = "INTERVIEW";
    public const string Backup = "BACKUP";
    public const string BackupNotSelected = "BACKUP_NOT_SELECTED";
    public const string InterviewFailed = "INTERVIEW_FAILED";
    public const string OfferPending = "OFFER_PENDING";
    public const string OfferAccepted = "OFFER_ACCEPTED";
    public const string OfferDeclined = "OFFER_DECLINED";
    public const string NotStarted = "NOT_STARTED";
    public const string Withdrawn = "WITHDRAWN";
    public const string Placed = "PLACED";
    public const string Closed = "CLOSED";
}

public static class InterviewStates
{
    public const string Scheduled = "SCHEDULED";
    public const string Cancelled = "CANCELLED";
    public const string Completed = "COMPLETED";
    public const string NoShow = "NO_SHOW";
}

public static class InterviewResults
{
    public const string Pass = "PASS";
    public const string Fail = "FAIL";
    public const string Backup = "BACKUP";
}

public static class OfferStates
{
    public const string Draft = "DRAFT";
    public const string Sent = "SENT";
    public const string Accepted = "ACCEPTED";
    public const string Declined = "DECLINED";
    public const string Withdrawn = "WITHDRAWN";
    public const string Expired = "EXPIRED";
}

public static class PlacementStates
{
    public const string Started = "STARTED";
}
