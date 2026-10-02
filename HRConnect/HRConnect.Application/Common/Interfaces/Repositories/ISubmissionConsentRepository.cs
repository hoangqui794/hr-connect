using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ISubmissionConsentRepository
{
    Task AddAsync(SubmissionConsent consent, CancellationToken cancellationToken = default);
    Task<SubmissionConsent?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);
    Task<SubmissionConsent?> GetBySubmissionIdAsync(Guid submissionId, CancellationToken cancellationToken = default);
    Task<SubmissionConsent?> GetActiveByCandidateAndJobAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default);
    void Update(SubmissionConsent consent);
}
