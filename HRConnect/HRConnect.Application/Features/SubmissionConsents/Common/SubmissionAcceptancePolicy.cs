using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.SubmissionConsents.Common;

public static class SubmissionAcceptancePolicy
{
    public static bool IsAffiliateEligible(AffiliateProfile? affiliate)
    {
        if (affiliate?.User == null ||
            !(string.Equals(affiliate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
              string.Equals(affiliate.Status, "VERIFIED", StringComparison.OrdinalIgnoreCase)) ||
            !string.Equals(affiliate.User.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return affiliate.User.UserRoleUsers.Any(userRole =>
            string.Equals(userRole.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
            userRole.Role.IsActive &&
            string.Equals(userRole.Role.Code, JobAccessPolicy.AffiliateRole, StringComparison.OrdinalIgnoreCase));
    }

    public static bool EnforcesClientOwnership(string? serviceTypeCode) =>
        string.Equals(serviceTypeCode, "HEADHUNT_COD", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(serviceTypeCode, "CV_SOURCING", StringComparison.OrdinalIgnoreCase);
}
