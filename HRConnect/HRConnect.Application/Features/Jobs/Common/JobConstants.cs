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

public static class JobVisibilities
{
    public const string Public = "PUBLIC";
    public const string PartnerOnly = "PARTNER_ONLY";
    public const string InternalOnly = "INTERNAL_ONLY";

    public static readonly string[] All = [Public, PartnerOnly, InternalOnly];

    public static bool CanExternalRoleAccess(string visibility, IReadOnlyCollection<string> roleCodes)
    {
        if (string.Equals(visibility, Public, StringComparison.OrdinalIgnoreCase)) return true;
        if (!string.Equals(visibility, PartnerOnly, StringComparison.OrdinalIgnoreCase)) return false;

        return roleCodes.Any(role =>
            string.Equals(role, "AFFILIATE_RECRUITER", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "HEADHUNTER", StringComparison.OrdinalIgnoreCase));
    }
}
