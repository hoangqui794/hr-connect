namespace HRConnect.Application.Features.Jobs.Common;

public static class JobStatuses
{
    public const string Draft = "DRAFT";
    public const string PendingReview = "PENDING_REVIEW";
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

public static class JobReasonCodes
{
    public const string DraftCreated = "DRAFT_CREATED";
    public const string SubmittedForReview = "SUBMITTED_FOR_REVIEW";
    public const string Approved = "APPROVED";
    public const string RejectedIncompleteDescription = "REJECTED_INCOMPLETE_DESCRIPTION";
    public const string RejectedIncompleteRequirements = "REJECTED_INCOMPLETE_REQUIREMENTS";
    public const string RejectedOther = "REJECTED_OTHER";
    public const string PausedByClient = "PAUSED_BY_CLIENT";
    public const string ResumedByClient = "RESUMED_BY_CLIENT";
    public const string ClosedPositionFilled = "CLOSED_POSITION_FILLED";
    public const string ClosedByClient = "CLOSED_BY_CLIENT";
    public const string ClosedOther = "CLOSED_OTHER";

    public static readonly string[] RejectionCodes = [RejectedIncompleteDescription, RejectedIncompleteRequirements, RejectedOther];
    public static readonly string[] CloseCodes = [ClosedPositionFilled, ClosedByClient, ClosedOther];
}

public static class JobVisibilities
{
    public const string Public = "PUBLIC";
    public const string PartnerOnly = "PARTNER_ONLY";
    public const string InternalOnly = "INTERNAL_ONLY";

    public static readonly string[] All = [Public, PartnerOnly, InternalOnly];
}
