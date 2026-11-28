namespace HRConnect.Application.Features.Jobs.Common;

public static class JobStatuses
{
    public const string Draft = "DRAFT";
    public const string PendingReview = "PENDING_REVIEW";
    public const string PendingAgreement = "PENDING_AGREEMENT";
    public const string PendingPayment = "PENDING_PAYMENT";
    public const string Rejected = "REJECTED";
    public const string Active = "ACTIVE";
    public const string Paused = "PAUSED";
    public const string Closed = "CLOSED";
}

public static class JobRequirementTypes
{
    public const string MustHave = "MUST_HAVE";
    public const string ShouldHave = "SHOULD_HAVE";

    public static readonly string[] All = [MustHave, ShouldHave];
}

public static class EmploymentTypes
{
    public const string FullTime = "FULL_TIME";
    public const string PartTime = "PART_TIME";
    public const string Contract = "CONTRACT";
    public const string Internship = "INTERNSHIP";
    public const string Freelance = "FREELANCE";

    public static readonly string[] All = [FullTime, PartTime, Contract, Internship, Freelance];
}

/// <summary>
/// PostgreSQL timestamptz only accepts UTC. Dates sent without an offset (e.g. "2026-12-31") arrive as
/// DateTimeKind.Unspecified and used to make SaveChanges throw (HTTP 500); treat them as UTC instead.
/// </summary>
public static class JobDates
{
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    public static DateTime? ToUtc(DateTime? value) => value?.Kind switch
    {
        null => null,
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.Value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value!.Value, DateTimeKind.Utc),
    };

    /// <summary>
    /// Computes the effective UTC expiration moment for an application deadline
    /// (treating date-only timestamps as end-of-day in Vietnam timezone UTC+7).
    /// </summary>
    public static DateTime? GetEffectiveDeadlineUtc(DateTime? deadline)
    {
        if (!deadline.HasValue) return null;
        var utc = ToUtc(deadline)!.Value;
        var vnLocal = utc + VietnamOffset;
        var endOfVnDayUtc = DateTime.SpecifyKind(
            new DateTime(vnLocal.Year, vnLocal.Month, vnLocal.Day, 23, 59, 59, 999, DateTimeKind.Unspecified) - VietnamOffset,
            DateTimeKind.Utc);
        return utc > endOfVnDayUtc ? utc : endOfVnDayUtc;
    }

    public static bool IsApplicationDeadlineExpired(DateTime? deadline, DateTime? nowUtc = null)
    {
        var effectiveDeadlineUtc = GetEffectiveDeadlineUtc(deadline);
        return effectiveDeadlineUtc.HasValue && effectiveDeadlineUtc.Value < (nowUtc ?? DateTime.UtcNow);
    }
}

public static class JobReasonCodes
{
    public const string DraftCreated = "DRAFT_CREATED";
    public const string SubmittedForReview = "SUBMITTED_FOR_REVIEW";
    public const string Approved = "APPROVED";
    public const string AgreementProposed = "AGREEMENT_PROPOSED";
    public const string AgreementChangesRequested = "AGREEMENT_CHANGES_REQUESTED";
    public const string AgreementSigned = "AGREEMENT_SIGNED";
    public const string RejectedIncompleteDescription = "REJECTED_INCOMPLETE_DESCRIPTION";
    public const string RejectedIncompleteRequirements = "REJECTED_INCOMPLETE_REQUIREMENTS";
    public const string RejectedTermsNotAgreed = "REJECTED_TERMS_NOT_AGREED";
    public const string RejectedOther = "REJECTED_OTHER";
    public const string PausedByClient = "PAUSED_BY_CLIENT";
    public const string ResumedByClient = "RESUMED_BY_CLIENT";
    public const string ClosedPositionFilled = "CLOSED_POSITION_FILLED";
    public const string ClosedByClient = "CLOSED_BY_CLIENT";
    public const string ClosedExpired = "CLOSED_EXPIRED";
    public const string ClosedQuotaReached = "CLOSED_QUOTA_REACHED";
    public const string ClosedOther = "CLOSED_OTHER";

    public static readonly string[] RejectionCodes = [RejectedIncompleteDescription, RejectedIncompleteRequirements, RejectedTermsNotAgreed, RejectedOther];
    public static readonly string[] CloseCodes = [ClosedPositionFilled, ClosedByClient, ClosedExpired, ClosedQuotaReached, ClosedOther];
}

public static class JobPostingPackageCodes
{
    public const string Free = "FREE";
    public const string Standard = "STANDARD";

    public static readonly string[] All = [Free, Standard];
}

public static class JobPostingFeeStatuses
{
    public const string Pending = "PENDING";
    public const string Paid = "PAID";
    public const string Cancelled = "CANCELLED";

    public static readonly string[] All = [Pending, Paid, Cancelled];
}

