using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class CandidateRepository : ICandidateRepository
{
    private readonly ApplicationDbContext _context;

    public CandidateRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Candidate?> FindByIdentityAsync(
        string? normalizedEmail,
        string? normalizedPhone,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(normalizedEmail) && string.IsNullOrWhiteSpace(normalizedPhone))
        {
            return null;
        }

        var query = _context.Candidates.AsQueryable();

        if (!string.IsNullOrWhiteSpace(normalizedEmail) && !string.IsNullOrWhiteSpace(normalizedPhone))
        {
            return await query.FirstOrDefaultAsync(c =>
                c.NormalizedEmail == normalizedEmail || c.NormalizedPhone == normalizedPhone,
                cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return await query.FirstOrDefaultAsync(c => c.NormalizedEmail == normalizedEmail, cancellationToken);
        }

        return await query.FirstOrDefaultAsync(c => c.NormalizedPhone == normalizedPhone, cancellationToken);
    }

    public async Task AddAsync(Candidate candidate, CancellationToken cancellationToken = default)
    {
        await _context.Candidates.AddAsync(candidate, cancellationToken);
    }

    public void Update(Candidate candidate)
    {
        _context.Candidates.Update(candidate);
    }

    public async Task<Candidate?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Candidates
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
    }

    public async Task<Candidate?> GetByUserIdWithDetailsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Candidates
            .Include(c => c.User)
            .Include(c => c.CandidateSkills)
                .ThenInclude(cs => cs.Skill)
            .Include(c => c.CandidateCv)
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
    }

    public async Task<Candidate?> GetByIdAsync(Guid candidateId, CancellationToken cancellationToken = default)
    {
        return await _context.Candidates
            .FirstOrDefaultAsync(c => c.CandidateId == candidateId, cancellationToken);
    }

    public async Task<Candidate?> GetByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(normalizedEmail)) return null;
        return await _context.Candidates
            .FirstOrDefaultAsync(c => c.NormalizedEmail == normalizedEmail, cancellationToken);
    }

    public async Task<Candidate?> GetByNormalizedPhoneAsync(string normalizedPhone, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(normalizedPhone)) return null;
        return await _context.Candidates
            .FirstOrDefaultAsync(c => c.NormalizedPhone == normalizedPhone, cancellationToken);
    }
}
