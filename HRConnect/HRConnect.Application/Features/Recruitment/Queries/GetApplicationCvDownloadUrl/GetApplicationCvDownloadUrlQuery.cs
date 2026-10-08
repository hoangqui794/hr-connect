using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetApplicationCvDownloadUrl;

/// <summary>
/// Signed, short-lived link to the CV attached to an application, for the Client company that owns
/// the job and for Internal HR / Platform Admin. Follows the same visibility and masking rules as
/// GET /recruitment/applications/{id} (MF-03).
/// </summary>
public record GetApplicationCvDownloadUrlQuery(
    Guid ApplicationId,
    Guid UserId,
    bool IsClientCompanyUser,
    bool IsInternalHrOrAdmin
) : IRequest<GetApplicationCvDownloadUrlResponse>;
