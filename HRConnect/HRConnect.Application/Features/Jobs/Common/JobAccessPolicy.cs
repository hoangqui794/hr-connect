using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Jobs.Common;

public static class JobAccessPolicy
{
    public const string CandidateRole = "CANDIDATE";
    public const string AffiliateRole = "AFFILIATE_RECRUITER";

    public static IReadOnlyCollection<string> GetDiscoverableVisibilities(
        IReadOnlyCollection<string>? roleCodes,
        bool hasInternalAccess)
    {
        if (hasInternalAccess) return JobVisibilities.All;
        return HasPartnerRole(roleCodes)
            ? [JobVisibilities.Public, JobVisibilities.PartnerOnly]
            : [JobVisibilities.Public];
    }

    public static bool CanViewDetail(
        Job job,
        bool isOwner,
        bool hasInternalAccess,
        IReadOnlyCollection<string>? roleCodes)
    {
        if (isOwner || hasInternalAccess) return true;
        return string.Equals(job.Status, JobStatuses.Active, StringComparison.OrdinalIgnoreCase) &&
               GetDiscoverableVisibilities(roleCodes, false).Contains(
                   job.Visibility, StringComparer.OrdinalIgnoreCase);
    }

    public static bool CanCandidateApply(Job job, IReadOnlyCollection<string>? roleCodes) =>
        HasRole(roleCodes, CandidateRole) &&
        string.Equals(job.Status, JobStatuses.Active, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(job.Visibility, JobVisibilities.Public, StringComparison.OrdinalIgnoreCase);

    public static bool CanAffiliateSubmit(Job job, IReadOnlyCollection<string>? roleCodes) =>
        HasPartnerRole(roleCodes) &&
        string.Equals(job.Status, JobStatuses.Active, StringComparison.OrdinalIgnoreCase) &&
        (string.Equals(job.Visibility, JobVisibilities.Public, StringComparison.OrdinalIgnoreCase) ||
         string.Equals(job.Visibility, JobVisibilities.PartnerOnly, StringComparison.OrdinalIgnoreCase));

    public static bool CanManageJob(Job job, Guid companyId) => job.CompanyId == companyId;

    public static bool IsVisibilityAllowedForServiceType(string? serviceTypeCode, string? visibility)
    {
        if (string.IsNullOrWhiteSpace(serviceTypeCode) || string.IsNullOrWhiteSpace(visibility))
            return false;

        var normalizedServiceType = serviceTypeCode.Trim().ToUpperInvariant();
        var normalizedVisibility = visibility.Trim().ToUpperInvariant();

        return normalizedServiceType switch
        {
            ServiceTypeCodes.CvApplication => normalizedVisibility is
                JobVisibilities.Public or JobVisibilities.InternalOnly,
            ServiceTypeCodes.CvSourcing or ServiceTypeCodes.HeadhuntCod => normalizedVisibility is
                JobVisibilities.PartnerOnly or JobVisibilities.InternalOnly,
            _ => false
        };
    }

    public static string VisibilityMatrixError(string? serviceTypeCode) =>
        $"Visibility is not allowed for Service Type {serviceTypeCode}. " +
        "CV_APPLICATION supports PUBLIC or INTERNAL_ONLY; " +
        "CV_SOURCING and HEADHUNT_COD support PARTNER_ONLY or INTERNAL_ONLY.";

    private static bool HasPartnerRole(IReadOnlyCollection<string>? roleCodes) =>
        HasRole(roleCodes, AffiliateRole);

    private static bool HasRole(IReadOnlyCollection<string>? roleCodes, string expected) =>
        roleCodes?.Contains(expected, StringComparer.OrdinalIgnoreCase) == true;
}

public static class ServiceTypeCodes
{
    public const string CvApplication = "CV_APPLICATION";
    public const string CvSourcing = "CV_SOURCING";
    public const string HeadhuntCod = "HEADHUNT_COD";
}
