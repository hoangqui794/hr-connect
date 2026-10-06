using System.Linq.Expressions;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Features.Recruitment.Common;

public enum ContactOwner
{
    ClientCompany,
    InternalHr
}

/// <summary>
/// What a Client Company user may see of an application (MF-03, docs/main-flows.md).
/// HEADHUNT_COD and CV_SOURCING applications are screened by Internal HR first, so the
/// Client only sees them once they have been SHORTLISTED. For HEADHUNT_COD, Internal HR
/// owns candidate contact, so contact details are hidden from the Client until PLACED.
/// </summary>
public static class ClientVisibilityPolicy
{
    private static readonly string[] PostShortlistStatuses =
    [
        ApplicationStates.Shortlisted,
        ApplicationStates.Interview,
        ApplicationStates.InterviewFailed,
        ApplicationStates.OfferPending,
        ApplicationStates.OfferAccepted,
        ApplicationStates.OfferDeclined,
        ApplicationStates.NotStarted,
        ApplicationStates.Placed
    ];

    /// <summary>
    /// Translatable to SQL so list paging counts stay correct. "Ever shortlisted" keeps
    /// applications visible after they move on (BACKUP after an interview, WITHDRAWN...).
    /// </summary>
    public static readonly Expression<Func<JobApplication, bool>> IsVisibleToClientExpression = a =>
        a.Job.ServiceType.Code == ServiceTypeCodes.CvApplication
        || PostShortlistStatuses.Contains(a.Status)
        || a.ApplicationStatusHistories.Any(h => h.NewStatus == ApplicationStates.Shortlisted);

    public static bool IsVisibleToClient(string? serviceTypeCode, string? status, IEnumerable<string?> historyNewStatuses)
    {
        if (string.Equals(serviceTypeCode?.Trim(), ServiceTypeCodes.CvApplication, StringComparison.OrdinalIgnoreCase))
            return true;

        var normalized = status?.Trim().ToUpperInvariant();
        return (normalized != null && PostShortlistStatuses.Contains(normalized))
               || historyNewStatuses.Any(s => string.Equals(s, ApplicationStates.Shortlisted, StringComparison.OrdinalIgnoreCase));
    }

    public static ContactOwner GetContactOwner(string? serviceTypeCode) =>
        string.Equals(serviceTypeCode?.Trim(), ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase)
            ? ContactOwner.InternalHr
            : ContactOwner.ClientCompany;

    public static bool ShouldMaskContactForClient(string? serviceTypeCode, string? applicationStatus, bool hasPlacement) =>
        GetContactOwner(serviceTypeCode) == ContactOwner.InternalHr
        && !hasPlacement
        && !string.Equals(applicationStatus?.Trim(), ApplicationStates.Placed, StringComparison.OrdinalIgnoreCase);
}
