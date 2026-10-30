using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Jobs.Common;

/// <summary>
/// Who may see and submit to a job is decided by role permissions only:
/// <c>service_type_allowed_role.can_view</c> / <c>can_submit</c> for the job's Service Type
/// (checked through <c>IJobRepository.CanAnyRoleViewJobAsync</c> / <c>CanAnyRoleSubmitJobAsync</c>).
/// This class only adds the rules that do not depend on that matrix: job status, ownership
/// and which actor an operation runs as. Guests are treated as the Candidate role.
/// </summary>
public static class JobAccessPolicy
{
    public const string CandidateRole = "CANDIDATE";
    public const string AffiliateRole = "AFFILIATE";

    /// <summary>
    /// Status part of viewing a job. Owners and internal users see every status; everyone else
    /// sees only ACTIVE jobs, and the caller must still check the role's can_view permission.
    /// </summary>
    public static bool CanViewDetail(Job job, bool isOwner, bool hasInternalAccess)
    {
        if (isOwner) return true;
        if (string.Equals(job.Status, JobStatuses.Draft, StringComparison.OrdinalIgnoreCase)) return false;
        if (hasInternalAccess) return true;
        return string.Equals(job.Status, JobStatuses.Active, StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsAcceptingApplications(Job job) =>
        string.Equals(job.Status, JobStatuses.Active, StringComparison.OrdinalIgnoreCase) &&
        (!job.ApplicationDeadline.HasValue || job.ApplicationDeadline.Value > DateTime.UtcNow);

    /// <summary>The caller must also check the Candidate role's can_submit permission.</summary>
    public static bool CanCandidateApply(Job job, IReadOnlyCollection<string>? roleCodes) =>
        HasRole(roleCodes, CandidateRole) && IsAcceptingApplications(job);

    /// <summary>The caller must also check the Affiliate role's can_submit permission.</summary>
    public static bool CanAffiliateSubmit(Job job, IReadOnlyCollection<string>? roleCodes) =>
        HasRole(roleCodes, AffiliateRole) && IsAcceptingApplications(job);

    public static bool CanManageJob(Job job, Guid companyId) => job.CompanyId == companyId;

    private static bool HasRole(IReadOnlyCollection<string>? roleCodes, string expected) =>
        roleCodes?.Contains(expected, StringComparer.OrdinalIgnoreCase) == true;
}

public static class ServiceTypeCodes
{
    public const string CvApplication = "CV_APPLICATION";
    public const string CvSourcing = "CV_SOURCING";
    public const string HeadhuntCod = "HEADHUNT_COD";
}
