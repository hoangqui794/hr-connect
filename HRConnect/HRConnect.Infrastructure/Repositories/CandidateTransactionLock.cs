using HRConnect.Application.Common.Interfaces;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class CandidateTransactionLock : ICandidateTransactionLock
{
    private readonly ApplicationDbContext _context;

    public CandidateTransactionLock(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AcquireAsync(Guid candidateId, CancellationToken cancellationToken = default)
    {
        if (_context.Database.CurrentTransaction == null)
        {
            throw new InvalidOperationException(
                "Candidate transaction lock must be acquired inside an active database transaction.");
        }

        var lockKey = $"mf04:candidate:{candidateId:N}";
        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))",
            cancellationToken);
    }
}
