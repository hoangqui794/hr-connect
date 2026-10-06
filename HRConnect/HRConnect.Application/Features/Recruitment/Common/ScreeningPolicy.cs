using HRConnect.Application.Features.Jobs.Common;

namespace HRConnect.Application.Features.Recruitment.Common;

public enum ScreeningActor
{
    ClientCompany,
    InternalHr
}

/// <summary>
/// Single source of truth for who screens applications of each Service Type (MF-03).
/// CV_APPLICATION is screened by the Company that owns the Job; HEADHUNT_COD and
/// CV_SOURCING are screened by Internal HR before the Company sees the shortlist.
/// </summary>
public static class ScreeningPolicy
{
    public static ScreeningActor? GetResponsibleActor(string? serviceTypeCode) =>
        serviceTypeCode?.Trim().ToUpperInvariant() switch
        {
            ServiceTypeCodes.CvApplication => ScreeningActor.ClientCompany,
            ServiceTypeCodes.HeadhuntCod or ServiceTypeCodes.CvSourcing => ScreeningActor.InternalHr,
            _ => null
        };

    public static bool CanScreen(ScreeningActor actor, string? serviceTypeCode) =>
        GetResponsibleActor(serviceTypeCode) == actor;
}
