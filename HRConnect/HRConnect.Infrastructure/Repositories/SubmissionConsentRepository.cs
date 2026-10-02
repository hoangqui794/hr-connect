using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class SubmissionConsentRepository : ISubmissionConsentRepository
{
    private readonly ApplicationDbContext _context;
    public SubmissionConsentRepository(ApplicationDbContext context) => _context = context;

    public Task AddAsync(SubmissionConsent consent, CancellationToken cancellationToken = default) =>
        _context.SubmissionConsents.AddAsync(consent, cancellationToken).AsTask();

    public Task<SubmissionConsent?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        _context.SubmissionConsents
            .Include(c => c.Submission).ThenInclude(s => s.Candidate)
            .Include(c => c.Submission).ThenInclude(s => s.CandidateCv)
            .Include(c => c.Submission).ThenInclude(s => s.Job).ThenInclude(j => j.Company)
            .FirstOrDefaultAsync(c => c.TokenHash == tokenHash, cancellationToken);

    public Task<SubmissionConsent?> GetActiveByCandidateAndJobAsync(Guid candidateId, Guid jobId, CancellationToken cancellationToken = default) =>
        _context.SubmissionConsents
            .Include(c => c.Submission)
            .FirstOrDefaultAsync(c => c.Submission.CandidateId == candidateId &&
                                      c.Submission.JobId == jobId &&
                                      c.Status == "PENDING" && c.ExpiresAt > DateTime.UtcNow,
                cancellationToken);

    public void Update(SubmissionConsent consent) => _context.SubmissionConsents.Update(consent);
}
