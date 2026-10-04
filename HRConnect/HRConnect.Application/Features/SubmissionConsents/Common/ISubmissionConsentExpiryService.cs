using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.SubmissionConsents.Common;

public interface ISubmissionConsentExpiryService
{
    Task<bool> ExpireAsync(
        SubmissionConsent consent,
        DateTime now,
        Guid? actorUserId,
        string source,
        CancellationToken cancellationToken = default);
}
