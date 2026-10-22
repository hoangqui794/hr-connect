using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class ServiceAgreementRepository : IServiceAgreementRepository
{
    private readonly ApplicationDbContext _context;

    public ServiceAgreementRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ServiceAgreement?> GetByIdAsync(Guid agreementId, CancellationToken cancellationToken = default)
    {
        return await _context.ServiceAgreements
            .AsNoTracking()
            .Include(a => a.Job)
            .Include(a => a.Company)
            .Include(a => a.SignerUser)
            .Include(a => a.CreatedByUser)
            .Include(a => a.VoidedByUser)
            .FirstOrDefaultAsync(a => a.ServiceAgreementId == agreementId, cancellationToken);
    }

    public async Task<ServiceAgreement?> GetByIdForUpdateAsync(Guid agreementId, CancellationToken cancellationToken = default)
    {
        return await _context.ServiceAgreements
            .Include(a => a.Job)
            .Include(a => a.Company)
            .Include(a => a.SignerUser)
            .Include(a => a.CreatedByUser)
            .Include(a => a.VoidedByUser)
            .FirstOrDefaultAsync(a => a.ServiceAgreementId == agreementId, cancellationToken);
    }

    public async Task<ServiceAgreement?> GetCurrentByJobIdAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        return await _context.ServiceAgreements
            .AsNoTracking()
            .Include(a => a.Job)
            .Include(a => a.Company)
            .Include(a => a.SignerUser)
            .Include(a => a.CreatedByUser)
            .FirstOrDefaultAsync(a => a.JobId == jobId && a.IsCurrent && a.Status != ServiceAgreementStatuses.Void, cancellationToken);
    }

    public async Task<ServiceAgreement?> GetByVerificationCodeAsync(string verificationCode, CancellationToken cancellationToken = default)
    {
        return await _context.ServiceAgreements
            .AsNoTracking()
            .Include(a => a.Job)
            .Include(a => a.Company)
            .FirstOrDefaultAsync(a => a.VerificationCode == verificationCode, cancellationToken);
    }

    public async Task<IReadOnlyList<ServiceAgreement>> GetHistoryByJobIdAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        return await _context.ServiceAgreements
            .AsNoTracking()
            .Include(a => a.SignerUser)
            .Include(a => a.CreatedByUser)
            .Where(a => a.JobId == jobId)
            .OrderByDescending(a => a.Version)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(ServiceAgreement agreement, CancellationToken cancellationToken = default)
    {
        await _context.ServiceAgreements.AddAsync(agreement, cancellationToken);
    }

    public async Task<ServiceAgreementSignatureChallenge?> GetActiveChallengeAsync(
        Guid agreementId,
        Guid signerUserId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default)
    {
        return await _context.ServiceAgreementSignatureChallenges
            .Where(c => c.ServiceAgreementId == agreementId &&
                        c.SignerUserId == signerUserId &&
                        !c.IsConsumed &&
                        !c.IsRevoked &&
                        c.ExpiresAt > nowUtc)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddChallengeAsync(ServiceAgreementSignatureChallenge challenge, CancellationToken cancellationToken = default)
    {
        await _context.ServiceAgreementSignatureChallenges.AddAsync(challenge, cancellationToken);
    }

    public async Task<int> GetChallengeCountTodayAsync(Guid signerUserId, DateTime todayUtc, CancellationToken cancellationToken = default)
    {
        return await _context.ServiceAgreementSignatureChallenges
            .CountAsync(c => c.SignerUserId == signerUserId && c.CreatedAt >= todayUtc, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await _context.SaveChangesAsync(cancellationToken);
    }
}
