using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class CandidateCvRepository : ICandidateCvRepository
{
    private readonly ApplicationDbContext _context;

    public CandidateCvRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CandidateCv?> GetByIdAsync(Guid cvId, CancellationToken cancellationToken = default)
    {
        return await _context.CandidateCvs
            .FirstOrDefaultAsync(c => c.CvId == cvId, cancellationToken);
    }

    public async Task<CandidateCv?> GetByCandidateIdAndCvIdAsync(Guid candidateId, Guid cvId, CancellationToken cancellationToken = default)
    {
        return await _context.CandidateCvs
            .FirstOrDefaultAsync(c => c.CandidateId == candidateId && c.CvId == cvId, cancellationToken);
    }

    public async Task<CandidateCv?> GetPrimaryByCandidateIdAsync(Guid candidateId, CancellationToken cancellationToken = default)
    {
        return await _context.CandidateCvs
            .FirstOrDefaultAsync(c => c.CandidateId == candidateId && c.IsPrimary && c.Status == "ACTIVE", cancellationToken);
    }

    public async Task<List<CandidateCv>> GetByCandidateIdAsync(Guid candidateId, CancellationToken cancellationToken = default)
    {
        return await _context.CandidateCvs
            .AsNoTracking()
            .Where(c => c.CandidateId == candidateId && c.Status == "ACTIVE")
            .OrderByDescending(c => c.IsPrimary)
            .ThenByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(CandidateCv candidateCv, CancellationToken cancellationToken = default)
    {
        await _context.CandidateCvs.AddAsync(candidateCv, cancellationToken);
    }

    public void Update(CandidateCv candidateCv)
    {
        _context.CandidateCvs.Update(candidateCv);
    }

    public void Delete(CandidateCv candidateCv)
    {
        _context.CandidateCvs.Remove(candidateCv);
    }
}
